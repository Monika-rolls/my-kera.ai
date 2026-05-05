from pydantic import BaseModel
from typing import Optional


class AppointmentCreate(BaseModel):
    user_id: str
    name: str
    phone_number: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
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
