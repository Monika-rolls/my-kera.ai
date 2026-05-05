from datetime import datetime
from sqlalchemy import select

from .database import Appointment, User, AsyncSessionLocal

# Hardcoded available time slots
AVAILABLE_SLOTS = {
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
}


async def identify_user(phone_number: str) -> dict:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.phone_number == phone_number)
        )
        user = result.scalar_one_or_none()
        if user:
            return {"found": True, "user_id": phone_number, "name": user.name}
        return {"found": False, "user_id": phone_number, "name": None}


async def fetch_slots(date_str: str) -> list[str]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Appointment.time).where(
                Appointment.date == date_str,
                Appointment.status == "confirmed",
            )
        )
        booked = {row[0] for row in result.fetchall()}
        return sorted(AVAILABLE_SLOTS - booked)


async def book_appointment(
    user_id: str,
    name: str,
    phone_number: str,
    date_str: str,
    time_str: str,
    notes: str = "",
) -> dict:
    async with AsyncSessionLocal() as session:
        conflict = await session.execute(
            select(Appointment).where(
                Appointment.date == date_str,
                Appointment.time == time_str,
                Appointment.status == "confirmed",
            )
        )
        if conflict.scalar_one_or_none():
            return {"success": False, "error": "Slot already booked. Please choose another time."}

        appt = Appointment(
            user_id=user_id,
            name=name,
            phone_number=phone_number,
            date=date_str,
            time=time_str,
            notes=notes or None,
            status="confirmed",
        )
        session.add(appt)

        user_result = await session.execute(
            select(User).where(User.phone_number == phone_number)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            session.add(User(phone_number=phone_number, name=name))
        elif user.name is None:
            user.name = name

        await session.commit()
        await session.refresh(appt)
        return {
            "success": True,
            "appointment_id": appt.id,
            "date": date_str,
            "time": time_str,
            "name": name,
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
        return {"success": True, "message": f"Appointment on {appt.date} at {appt.time} has been cancelled."}


async def modify_appointment(
    appointment_id: int, user_id: str, new_date: str, new_time: str
) -> dict:
    async with AsyncSessionLocal() as session:
        conflict = await session.execute(
            select(Appointment).where(
                Appointment.date == new_date,
                Appointment.time == new_time,
                Appointment.status == "confirmed",
                Appointment.id != appointment_id,
            )
        )
        if conflict.scalar_one_or_none():
            return {"success": False, "error": "The new slot is already taken."}

        result = await session.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.user_id == user_id,
            )
        )
        appt = result.scalar_one_or_none()
        if not appt:
            return {"success": False, "error": "Appointment not found."}

        appt.date = new_date
        appt.time = new_time
        await session.commit()
        return {
            "success": True,
            "message": f"Appointment rescheduled to {new_date} at {new_time}.",
        }
