from pydantic import BaseModel
from typing import Optional


class AppointmentCreate(BaseModel):
    user_id: str
    name: str
    phone_number: str
    email: Optional[str] = None
    date: str          # YYYY-MM-DD
    time: str          # HH:MM
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    notes: Optional[str] = None


class TokenRequest(BaseModel):
    room_name: str
    participant_name: str = "user"


class TokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str


class SummaryRequest(BaseModel):
    transcript: list[dict]
    appointments: list[dict]
