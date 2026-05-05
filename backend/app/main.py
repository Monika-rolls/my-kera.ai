import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from livekit.api import AccessToken, VideoGrants

from .config import settings
from .database import init_db, get_session, Appointment, User
from .models import AppointmentCreate, TokenRequest, TokenResponse, SummaryRequest
from .summary import generate_call_summary

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialized")
    yield


app = FastAPI(title="Mykare Voice AI API", version="1.0.0", lifespan=lifespan)

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


@app.post("/token", response_model=TokenResponse)
async def get_livekit_token(request: TokenRequest):
    """Generate a LiveKit access token for the frontend client."""
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
    return TokenResponse(
        token=token.to_jwt(),
        room_name=request.room_name,
        livekit_url=settings.livekit_url,
    )


@app.get("/appointments/{phone_number}")
async def list_appointments(
    phone_number: str, session: AsyncSession = Depends(get_session)
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
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in result.scalars().all()
    ]


@app.post("/appointments", status_code=201)
async def create_appointment(
    data: AppointmentCreate, session: AsyncSession = Depends(get_session)
):
    conflict = await session.execute(
        select(Appointment).where(
            Appointment.date == data.date,
            Appointment.time == data.time,
            Appointment.status == "confirmed",
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Time slot already booked")

    appt = Appointment(
        user_id=data.user_id,
        name=data.name,
        phone_number=data.phone_number,
        date=data.date,
        time=data.time,
        notes=data.notes,
        status="confirmed",
    )
    session.add(appt)
    await session.commit()
    await session.refresh(appt)
    return {"id": appt.id, "message": "Appointment created"}


@app.delete("/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: int, session: AsyncSession = Depends(get_session)
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


@app.post("/summary")
async def create_summary(data: SummaryRequest):
    return await generate_call_summary(data.transcript, data.appointments)


# AWS Lambda adapter
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    pass
