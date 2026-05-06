import asyncio
import json
import logging
from typing import Annotated
from datetime import datetime

from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import cartesia, deepgram, silero
from livekit.plugins import openai as openai_plugin

from .config import settings
from .database import init_db
from . import tools as tool_funcs
from .summary import generate_call_summary

logger = logging.getLogger("mykare.agent")


def _build_llm():
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        from livekit.plugins import google as google_plugin
        model = settings.llm_model or "gemini-2.0-flash"
        logger.info(f"LLM: Gemini ({model})")
        return google_plugin.LLM(
            model=model,
            api_key=settings.gemini_api_key or None,
        )
    model = settings.llm_model or "gpt-4o"
    logger.info(f"LLM: OpenAI ({model})")
    return openai_plugin.LLM(model=model, api_key=settings.openai_api_key or None)

SYSTEM_PROMPT = """You are Mia, a warm and professional AI front-desk assistant for Mykare Health clinic.
Your role is to help patients with appointment scheduling and management.

WORKFLOW:
1. Greet the patient and ask how you can help
2. ALWAYS call identify_user first to get/register their phone number
3. Based on intent, call the appropriate tools
4. Confirm all details clearly before booking
5. Call end_conversation when the patient is done

TOOLS TO USE:
- identify_user: first thing — get patient's phone number
- fetch_slots: when patient wants to see availability
- book_appointment: after confirming date/time with patient
- retrieve_appointments: to show existing bookings
- cancel_appointment: when patient wants to cancel
- modify_appointment: when patient wants to reschedule
- end_conversation: to close the call and generate summary

VOICE RULES:
- Keep responses SHORT (1-3 sentences max) — this is voice, not text
- Speak naturally and conversationally
- Confirm key details (date, time) by repeating them back
- Always be warm but efficient
- Today's date: {current_date}"""


class HealthcareAgent(Agent):
    def __init__(self) -> None:
        current_date = datetime.now().strftime("%Y-%m-%d (%A)")
        super().__init__(
            instructions=SYSTEM_PROMPT.format(current_date=current_date)
        )
        self.transcript: list[dict] = []
        self.booked_appointments: list[dict] = []
        self.user_id: str | None = None

    async def _emit(self, tool: str, status: str, data: dict | None = None) -> None:
        payload = json.dumps({
            "type": "tool_event",
            "tool": tool,
            "status": status,
            "data": data or {},
            "timestamp": datetime.now().isoformat(),
        }).encode()
        try:
            await self.session.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            logger.warning(f"Failed to publish tool event: {e}")

    @function_tool
    async def identify_user(
        self,
        phone_number: Annotated[str, "Patient phone number, digits only, e.g. 9876543210"],
    ) -> str:
        """Identify or register a patient by their phone number. Always call this first before any other action."""
        await self._emit("identify_user", "calling", {"phone_number": phone_number})
        result = await tool_funcs.identify_user(phone_number)
        self.user_id = phone_number
        await self._emit("identify_user", "success", result)
        if result["found"]:
            name = result["name"] or "there"
            return f"Patient recognized: {name} (ID: {phone_number}). How can I help you today?"
        return f"Welcome! New patient registered with ID {phone_number}. What's your name, and how can I help you?"

    @function_tool
    async def fetch_slots(
        self,
        date: Annotated[str, "Date in YYYY-MM-DD format"],
    ) -> str:
        """Fetch available appointment slots for a given date."""
        await self._emit("fetch_slots", "calling", {"date": date})
        slots = await tool_funcs.fetch_slots(date)
        await self._emit("fetch_slots", "success", {"date": date, "available_slots": slots})
        if not slots:
            return f"No available slots on {date}. Would you like to try another date?"
        readable = ", ".join(slots[:6])
        more = f" and {len(slots) - 6} more" if len(slots) > 6 else ""
        return f"Available times on {date}: {readable}{more}. Which works for you?"

    @function_tool
    async def book_appointment(
        self,
        name: Annotated[str, "Patient's full name"],
        phone_number: Annotated[str, "Patient's phone number"],
        date: Annotated[str, "Appointment date in YYYY-MM-DD format"],
        time: Annotated[str, "Appointment time in HH:MM 24-hour format"],
        notes: Annotated[str, "Reason for visit or special notes"] = "",
    ) -> str:
        """Book an appointment for the patient after confirming all details."""
        uid = self.user_id or phone_number
        await self._emit("book_appointment", "calling", {"name": name, "date": date, "time": time})
        result = await tool_funcs.book_appointment(uid, name, phone_number, date, time, notes)
        if result["success"]:
            self.booked_appointments.append(result)
            await self._emit("book_appointment", "success", result)
            return f"Booked! {name}, your appointment is confirmed for {date} at {time}. Confirmation ID: {result['appointment_id']}."
        await self._emit("book_appointment", "error", result)
        return f"Sorry, {result['error']} Shall I check other available times?"

    @function_tool
    async def retrieve_appointments(self) -> str:
        """Retrieve all appointments for the current patient."""
        if not self.user_id:
            return "Let me get your phone number first to look up your appointments."
        await self._emit("retrieve_appointments", "calling", {"user_id": self.user_id})
        appts = await tool_funcs.retrieve_appointments(self.user_id)
        await self._emit("retrieve_appointments", "success", {"appointments": appts})
        if not appts:
            return "You have no appointments on record. Would you like to book one?"
        confirmed = [a for a in appts if a["status"] == "confirmed"]
        lines = "; ".join(f"{a['date']} at {a['time']}" for a in confirmed[:3])
        return f"You have {len(confirmed)} upcoming appointment(s): {lines}."

    @function_tool
    async def cancel_appointment(
        self,
        appointment_id: Annotated[int, "The numeric appointment ID to cancel"],
    ) -> str:
        """Cancel an existing appointment by its ID."""
        if not self.user_id:
            return "I need to identify you first. What's your phone number?"
        await self._emit("cancel_appointment", "calling", {"appointment_id": appointment_id})
        result = await tool_funcs.cancel_appointment(appointment_id, self.user_id)
        status = "success" if result["success"] else "error"
        await self._emit("cancel_appointment", status, result)
        return result.get("message") or result.get("error", "An error occurred.")

    @function_tool
    async def modify_appointment(
        self,
        appointment_id: Annotated[int, "The appointment ID to reschedule"],
        new_date: Annotated[str, "New date in YYYY-MM-DD format"],
        new_time: Annotated[str, "New time in HH:MM 24-hour format"],
    ) -> str:
        """Reschedule an appointment to a new date and time."""
        if not self.user_id:
            return "I need to identify you first. What's your phone number?"
        await self._emit("modify_appointment", "calling", {
            "appointment_id": appointment_id, "new_date": new_date, "new_time": new_time,
        })
        result = await tool_funcs.modify_appointment(appointment_id, self.user_id, new_date, new_time)
        status = "success" if result["success"] else "error"
        await self._emit("modify_appointment", status, result)
        return result.get("message") or result.get("error", "An error occurred.")

    @function_tool
    async def end_conversation(self) -> str:
        """End the conversation and generate a call summary. Call this when the patient says goodbye or has no more requests."""
        await self._emit("end_conversation", "calling", {})
        summary = await generate_call_summary(self.transcript, self.booked_appointments)
        await self._emit("end_conversation", "success", summary)
        try:
            await self.session.room.local_participant.publish_data(
                json.dumps({
                    "type": "call_summary",
                    "summary": summary,
                    "timestamp": datetime.now().isoformat(),
                }).encode(),
                reliable=True,
            )
        except Exception as e:
            logger.warning(f"Failed to publish summary: {e}")
        return "It was lovely speaking with you! Your details are all saved. Take care and have a wonderful day!"


async def entrypoint(ctx: JobContext) -> None:
    await init_db()
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    logger.info(f"Room connected: {ctx.room.name}")

    session = AgentSession(
        stt=deepgram.STT(api_key=settings.deepgram_api_key, language="en-US"),
        llm=_build_llm(),
        tts=cartesia.TTS(api_key=settings.cartesia_api_key),
        vad=silero.VAD.load(),
    )

    agent = HealthcareAgent()

    @session.on("user_input_transcribed")
    def on_user_input(ev) -> None:
        if getattr(ev, "is_final", True):
            content = getattr(ev, "transcript", str(ev))
            agent.transcript.append({"role": "user", "content": content})
            asyncio.ensure_future(
                ctx.room.local_participant.publish_data(
                    json.dumps({
                        "type": "transcript",
                        "role": "user",
                        "content": content,
                        "timestamp": datetime.now().isoformat(),
                    }).encode(),
                    reliable=True,
                )
            )

    await session.start(room=ctx.room, agent=agent)

    await session.say(
        "Hello! I'm Mia, your AI assistant at Mykare Health. "
        "I can help you book, manage, or cancel appointments. "
        "May I start by getting your phone number?",
        allow_interruptions=True,
    )


def run_worker() -> None:
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
            ws_url=settings.livekit_url,
        )
    )


if __name__ == "__main__":
    run_worker()
