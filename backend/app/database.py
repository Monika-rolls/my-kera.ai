import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Integer, Float, Text, func, select, text
from datetime import datetime
from typing import AsyncGenerator

from .config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    display_name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(String(300))
    icon: Mapped[str] = mapped_column(String(10), default="🏥")


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    specialization: Mapped[str] = mapped_column(String(100))
    category_id: Mapped[int] = mapped_column(Integer, nullable=True)
    # comma-separated weekday names e.g. "Monday,Wednesday,Friday"
    available_days: Mapped[str] = mapped_column(String(200))
    # JSON array of time strings e.g. '["09:00","09:30"]'
    available_times: Mapped[str] = mapped_column(String(500))

    def days_list(self) -> list[str]:
        return [d.strip() for d in self.available_days.split(",")]

    def times_list(self) -> list[str]:
        return json.loads(self.available_times)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(200), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CallSession(Base):
    __tablename__ = "call_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_name: Mapped[str] = mapped_column(String(200), index=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
    user_name: Mapped[str] = mapped_column(String(100), nullable=True)
    intent: Mapped[str] = mapped_column(String(50), default="unknown")
    sentiment: Mapped[str] = mapped_column(String(20), default="neutral")
    summary_text: Mapped[str] = mapped_column(Text, nullable=True)
    summary_json: Mapped[str] = mapped_column(Text, nullable=True)
    tokens_total: Mapped[int] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(100))
    phone_number: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(200), nullable=True)
    date: Mapped[str] = mapped_column(String(10))    # YYYY-MM-DD
    time: Mapped[str] = mapped_column(String(5))     # HH:MM
    doctor_id: Mapped[int] = mapped_column(Integer, nullable=True)
    doctor_name: Mapped[str] = mapped_column(String(100), nullable=True)
    category_id: Mapped[int] = mapped_column(Integer, nullable=True)
    category_name: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ── Seed data ─────────────────────────────────────────────────────────────────

_CATEGORIES_SEED = [
    {
        "name": "General Medicine",
        "display_name": "General Medicine",
        "description": "General checkup, fever, cold, fatigue, headaches",
        "icon": "🩺",
    },
    {
        "name": "Cardiology",
        "display_name": "Cardiology (Heart)",
        "description": "Heart problems, chest pain, blood pressure, palpitations",
        "icon": "❤️",
    },
    {
        "name": "Ophthalmology",
        "display_name": "Ophthalmology (Eyes)",
        "description": "Eye problems, vision issues, cataracts, glaucoma",
        "icon": "👁️",
    },
    {
        "name": "Gastroenterology",
        "display_name": "Gastroenterology (Stomach)",
        "description": "Stomach issues, digestive problems, acidity, ulcers",
        "icon": "🫃",
    },
    {
        "name": "Pediatrics",
        "display_name": "Pediatrics (Children)",
        "description": "Children's health (0–18 years), infant care, vaccinations",
        "icon": "👶",
    },
    {
        "name": "Orthopedics",
        "display_name": "Orthopedics (Bones & Joints)",
        "description": "Bone and joint problems, back pain, fractures, arthritis",
        "icon": "🦴",
    },
    {
        "name": "Dermatology",
        "display_name": "Dermatology (Skin)",
        "description": "Skin, hair, nail conditions, rashes, acne, eczema",
        "icon": "🧴",
    },
    {
        "name": "ENT",
        "display_name": "ENT (Ear, Nose & Throat)",
        "description": "Ear, nose, throat issues, sinus problems, hearing, tonsils",
        "icon": "👂",
    },
    {
        "name": "Neurology",
        "display_name": "Neurology (Brain & Nerves)",
        "description": "Brain and nerve disorders, migraines, seizures, vertigo",
        "icon": "🧠",
    },
    {
        "name": "Gynecology",
        "display_name": "Gynecology (Women's Health)",
        "description": "Women's health, pregnancy, menstrual issues, fertility",
        "icon": "🌸",
    },
]

# category_name is resolved to category_id during seeding
_DOCTORS_SEED = [
    {
        "name": "Dr. Priya Sharma",
        "specialization": "General Medicine",
        "category_name": "General Medicine",
        "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
            "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        ]),
    },
    {
        "name": "Dr. Rajesh Nair",
        "specialization": "Cardiology",
        "category_name": "Cardiology",
        "available_days": "Monday,Wednesday,Friday",
        "available_times": json.dumps([
            "10:00", "10:30", "11:00", "11:30", "15:00", "15:30", "16:00",
        ]),
    },
    {
        "name": "Dr. Kavitha Menon",
        "specialization": "Ophthalmology",
        "category_name": "Ophthalmology",
        "available_days": "Monday,Tuesday,Thursday,Friday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00",
        ]),
    },
    {
        "name": "Dr. Meera Joshi",
        "specialization": "Gastroenterology",
        "category_name": "Gastroenterology",
        "available_days": "Monday,Wednesday,Thursday,Saturday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "11:00", "11:30", "14:00", "15:00", "15:30",
        ]),
    },
    {
        "name": "Dr. Sunita Rao",
        "specialization": "Pediatrics",
        "category_name": "Pediatrics",
        "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
            "14:00", "14:30", "15:00", "15:30",
        ]),
    },
    {
        "name": "Dr. Vikram Patel",
        "specialization": "Orthopedics",
        "category_name": "Orthopedics",
        "available_days": "Monday,Wednesday,Thursday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "11:00", "11:30", "14:00", "15:00", "15:30",
        ]),
    },
    {
        "name": "Dr. Ananya Bose",
        "specialization": "Dermatology",
        "category_name": "Dermatology",
        "available_days": "Tuesday,Thursday,Saturday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00",
        ]),
    },
    {
        "name": "Dr. Arun Gupta",
        "specialization": "ENT",
        "category_name": "ENT",
        "available_days": "Tuesday,Wednesday,Friday",
        "available_times": json.dumps([
            "09:30", "10:00", "10:30", "11:00", "11:30", "14:30", "15:00", "15:30",
        ]),
    },
    {
        "name": "Dr. Kiran Reddy",
        "specialization": "Neurology",
        "category_name": "Neurology",
        "available_days": "Monday,Thursday,Friday",
        "available_times": json.dumps([
            "10:00", "10:30", "11:00", "11:30", "15:00", "15:30", "16:00",
        ]),
    },
    {
        "name": "Dr. Pooja Singh",
        "specialization": "Gynecology",
        "category_name": "Gynecology",
        "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
        "available_times": json.dumps([
            "09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00", "15:30",
        ]),
    },
]


async def init_db() -> None:
    """Initialize database, auto-migrating if the schema is outdated."""
    needs_reset = False
    async with engine.begin() as conn:
        # Detect old schema by checking for the categories table
        try:
            await conn.execute(text("SELECT id FROM categories LIMIT 1"))
        except Exception:
            needs_reset = True

        if needs_reset:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed if categories table is empty
    async with AsyncSessionLocal() as session:
        cat_count = await session.execute(select(func.count()).select_from(Category))
        if cat_count.scalar() == 0:
            # Insert categories first
            for cat_data in _CATEGORIES_SEED:
                session.add(Category(**cat_data))
            await session.commit()

            # Build name → id map
            cat_result = await session.execute(select(Category))
            cat_map = {c.name: c.id for c in cat_result.scalars().all()}

            # Insert doctors with resolved category_id
            for doc_data in _DOCTORS_SEED:
                doc = dict(doc_data)
                cat_name = doc.pop("category_name")
                doc["category_id"] = cat_map.get(cat_name)
                session.add(Doctor(**doc))
            await session.commit()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
