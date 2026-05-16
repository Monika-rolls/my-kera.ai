import json
from datetime import datetime
from sqlalchemy import select

from .database import Appointment, CallSession, Category, Doctor, User, AsyncSessionLocal


async def identify_user(phone_number: str, email: str = "", name: str = "") -> dict:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.phone_number == phone_number)
        )
        user = result.scalar_one_or_none()
        if user:
            # Update email if it wasn't stored yet
            if email and not user.email:
                user.email = email
                await session.commit()
            return {
                "found": True,
                "user_id": phone_number,
                "name": user.name,
                "email": user.email or email,
            }
        # Register new patient
        new_user = User(phone_number=phone_number, email=email or None, name=name or None)
        session.add(new_user)
        await session.commit()
        return {"found": False, "user_id": phone_number, "name": None, "email": email or None}


async def fetch_categories() -> list[dict]:
    async with AsyncSessionLocal() as session:
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


async def fetch_doctors(
    specialization: str | None = None,
    category_id: int | None = None,
) -> list[dict]:
    async with AsyncSessionLocal() as session:
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
            }
            for d in result.scalars().all()
        ]


async def fetch_slots(
    date_str: str,
    doctor_id: int | None = None,
    category_id: int | None = None,
) -> list[str]:
    async with AsyncSessionLocal() as session:
        day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")

        if doctor_id:
            doc_result = await session.execute(
                select(Doctor).where(Doctor.id == doctor_id)
            )
            doctor = doc_result.scalar_one_or_none()
            if not doctor or day_name not in doctor.days_list():
                return []
            available: set[str] = set(doctor.times_list())

            booked_result = await session.execute(
                select(Appointment.time).where(
                    Appointment.date == date_str,
                    Appointment.doctor_id == doctor_id,
                    Appointment.status == "confirmed",
                )
            )
            booked = {row[0] for row in booked_result.fetchall()}
            return sorted(available - booked)

        # Aggregate across a whole category or all doctors
        q = select(Doctor)
        if category_id:
            q = q.where(Doctor.category_id == category_id)
        all_docs = await session.execute(q)
        available = set()
        for d in all_docs.scalars().all():
            if day_name in d.days_list():
                available.update(d.times_list())

        booked_q = select(Appointment.time).where(
            Appointment.date == date_str,
            Appointment.status == "confirmed",
        )
        if category_id:
            booked_q = booked_q.where(Appointment.category_id == category_id)

        booked_result = await session.execute(booked_q)
        booked = {row[0] for row in booked_result.fetchall()}
        return sorted(available - booked)


async def book_appointment(
    user_id: str,
    name: str,
    phone_number: str,
    date_str: str,
    time_str: str,
    email: str = "",
    notes: str = "",
    doctor_id: int | None = None,
    doctor_name: str | None = None,
    category_id: int | None = None,
    category_name: str | None = None,
) -> dict:
    async with AsyncSessionLocal() as session:
        # Conflict check: same doctor + same slot
        conflict_q = select(Appointment).where(
            Appointment.date == date_str,
            Appointment.time == time_str,
            Appointment.status == "confirmed",
        )
        if doctor_id:
            conflict_q = conflict_q.where(Appointment.doctor_id == doctor_id)

        if (await session.execute(conflict_q)).scalar_one_or_none():
            return {
                "success": False,
                "error": "That slot is already booked. Please choose another time.",
            }

        appt = Appointment(
            user_id=user_id,
            name=name,
            phone_number=phone_number,
            email=email or None,
            date=date_str,
            time=time_str,
            doctor_id=doctor_id,
            doctor_name=doctor_name,
            category_id=category_id,
            category_name=category_name,
            notes=notes or None,
            status="confirmed",
        )
        session.add(appt)

        # Upsert user record
        user_result = await session.execute(
            select(User).where(User.phone_number == phone_number)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            session.add(User(phone_number=phone_number, name=name, email=email or None))
        else:
            if user.name is None:
                user.name = name
            if email and not user.email:
                user.email = email

        await session.commit()
        await session.refresh(appt)
        return {
            "success": True,
            "appointment_id": appt.id,
            "date": date_str,
            "time": time_str,
            "name": name,
            "doctor_name": doctor_name,
            "category_name": category_name,
        }


async def retrieve_appointments(user_id: str) -> list[dict]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Appointment)
            .where(Appointment.user_id == user_id)
            .order_by(Appointment.date, Appointment.time)
        )
        return [
            {
                "id": a.id,
                "date": a.date,
                "time": a.time,
                "doctor_name": a.doctor_name,
                "category_name": a.category_name,
                "status": a.status,
                "notes": a.notes,
            }
            for a in result.scalars().all()
        ]


async def cancel_appointment(appointment_id: int, user_id: str) -> dict:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.user_id == user_id,
            )
        )
        appt = result.scalar_one_or_none()
        if not appt:
            return {"success": False, "error": "Appointment not found."}
        if appt.status == "cancelled":
            return {"success": False, "error": "Appointment is already cancelled."}
        appt.status = "cancelled"
        await session.commit()
        return {
            "success": True,
            "message": f"Appointment on {appt.date} at {appt.time} has been cancelled.",
        }


async def modify_appointment(
    appointment_id: int, user_id: str, new_date: str, new_time: str
) -> dict:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.user_id == user_id,
            )
        )
        appt = result.scalar_one_or_none()
        if not appt:
            return {"success": False, "error": "Appointment not found."}

        conflict = await session.execute(
            select(Appointment).where(
                Appointment.date == new_date,
                Appointment.time == new_time,
                Appointment.status == "confirmed",
                Appointment.doctor_id == appt.doctor_id,
                Appointment.id != appointment_id,
            )
        )
        if conflict.scalar_one_or_none():
            return {"success": False, "error": "The new slot is already taken."}

        appt.date = new_date
        appt.time = new_time
        await session.commit()
        return {
            "success": True,
            "message": f"Appointment rescheduled to {new_date} at {new_time}.",
        }


async def save_call_session(room_name: str, summary: dict) -> int:
    tokens_used = summary.get("tokens_used") or {}
    tokens_total = tokens_used.get("total_tokens") if tokens_used else None

    async with AsyncSessionLocal() as session:
        cs = CallSession(
            room_name=room_name,
            phone_number=summary.get("phone_number"),
            user_name=summary.get("user_name"),
            intent=summary.get("intent", "unknown"),
            sentiment=summary.get("sentiment", "neutral"),
            summary_text=summary.get("summary"),
            summary_json=json.dumps(summary),
            tokens_total=tokens_total,
            cost_usd=summary.get("estimated_cost_usd"),
        )
        session.add(cs)
        await session.commit()
        await session.refresh(cs)
        return cs.id
