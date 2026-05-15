import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import time
from livekit.api import AccessToken, VideoGrants, LiveKitAPI, CreateAgentDispatchRequest

AGENT_NAME = "mia"
_dispatched_rooms: dict[str, float] = {}
_DISPATCH_TTL = 3600

from .config import settings
from .database import init_db, get_session, Appointment, Category, Doctor, User
from .models import AppointmentCreate, TokenRequest, TokenResponse, SummaryRequest
from .summary import generate_call_summary

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialized")
    yield


app = FastAPI(title="Mykare Voice AI API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ── Auth / LiveKit token ──────────────────────────────────────────────────────

@app.post("/token", response_model=TokenResponse)
async def get_livekit_token(request: TokenRequest):
    token = (
        AccessToken(
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
        .with_identity(request.participant_name)
        .with_name(request.participant_name)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=request.room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
    )

    now = time.time()
    last = _dispatched_rooms.get(request.room_name, 0)
    if now - last > _DISPATCH_TTL:
        try:
            async with LiveKitAPI(
                url=settings.livekit_url,
                api_key=settings.livekit_api_key,
                api_secret=settings.livekit_api_secret,
            ) as lk:
                await lk.agent_dispatch.create_dispatch(
                    CreateAgentDispatchRequest(
                        room=request.room_name,
                        agent_name=AGENT_NAME,
                    )
                )
            _dispatched_rooms[request.room_name] = now
            logger.info(f"Agent dispatched to room: {request.room_name}")
        except Exception as e:
            logger.warning(f"Agent dispatch failed: {e}")
    else:
        logger.info(f"Agent already dispatched to room: {request.room_name}, skipping")

    return TokenResponse(
        token=token.to_jwt(),
        room_name=request.room_name,
        livekit_url=settings.livekit_url,
    )


# ── Categories ────────────────────────────────────────────────────────────────

@app.get("/categories")
async def list_categories(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Category).order_by(Category.name))
    return [
        {
            "id": c.id,
            "name": c.name,
            "display_name": c.display_name,
            "description": c.description,
            "icon": c.icon,
        }
        for c in result.scalars().all()
    ]


# ── Doctors ───────────────────────────────────────────────────────────────────

@app.get("/doctors")
async def list_doctors(
    specialization: str | None = None,
    category_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(Doctor)
    if specialization:
        q = q.where(Doctor.specialization.ilike(f"%{specialization}%"))
    if category_id:
        q = q.where(Doctor.category_id == category_id)
    result = await session.execute(q.order_by(Doctor.specialization, Doctor.name))
    return [
        {
            "id": d.id,
            "name": d.name,
            "specialization": d.specialization,
            "category_id": d.category_id,
            "available_days": d.days_list(),
            "available_times": d.times_list(),
        }
        for d in result.scalars().all()
    ]


# ── Appointments ──────────────────────────────────────────────────────────────

@app.get("/appointments/{phone_number}")
async def list_appointments(
    phone_number: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Appointment)
        .where(Appointment.phone_number == phone_number)
        .order_by(Appointment.date, Appointment.time)
    )
    return [
        {
            "id": a.id,
            "date": a.date,
            "time": a.time,
            "status": a.status,
            "doctor_name": a.doctor_name,
            "category_name": a.category_name,
            "email": a.email,
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in result.scalars().all()
    ]


@app.post("/appointments", status_code=201)
async def create_appointment(
    data: AppointmentCreate,
    session: AsyncSession = Depends(get_session),
):
    conflict = await session.execute(
        select(Appointment).where(
            Appointment.date == data.date,
            Appointment.time == data.time,
            Appointment.status == "confirmed",
            *(
                [Appointment.doctor_id == data.doctor_id]
                if data.doctor_id
                else []
            ),
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Time slot already booked")

    appt = Appointment(
        user_id=data.user_id,
        name=data.name,
        phone_number=data.phone_number,
        email=data.email,
        date=data.date,
        time=data.time,
        doctor_id=data.doctor_id,
        doctor_name=data.doctor_name,
        category_id=data.category_id,
        category_name=data.category_name,
        notes=data.notes,
        status="confirmed",
    )
    session.add(appt)
    await session.commit()
    await session.refresh(appt)
    return {"id": appt.id, "message": "Appointment created"}


@app.delete("/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    appt.status = "cancelled"
    await session.commit()
    return {"message": "Cancelled"}


# ── Slots / availability ──────────────────────────────────────────────────────

@app.get("/slots")
async def get_slots(
    date: str,
    doctor_id: int | None = None,
    category_id: int | None = None,
):
    from . import tools as tool_funcs
    slots = await tool_funcs.fetch_slots(date, doctor_id, category_id)
    return {"date": date, "doctor_id": doctor_id, "category_id": category_id, "slots": slots}


@app.get("/availability")
async def get_monthly_availability(
    year: int,
    month: int,
    category_id: int | None = None,
):
    """Returns available slot count per date for the given year/month."""
    from calendar import monthrange
    from . import tools as tool_funcs

    _, days_in_month = monthrange(year, month)
    result: dict[str, int] = {}
    for day in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        slots = await tool_funcs.fetch_slots(date_str, None, category_id)
        result[date_str] = len(slots)
    return result


# ── Summary ───────────────────────────────────────────────────────────────────

@app.post("/summary")
async def create_summary(data: SummaryRequest):
    return await generate_call_summary(data.transcript, data.appointments)


# ── AWS Lambda adapter ────────────────────────────────────────────────────────

try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    pass
