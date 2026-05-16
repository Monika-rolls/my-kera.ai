import asyncio
import json
import logging
from typing import Annotated
from datetime import datetime

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.agents.metrics import LLMModelUsage
from livekit.plugins import deepgram, silero
from livekit.plugins import openai as openai_plugin

from .config import settings
from .database import init_db
from . import tools as tool_funcs
from .summary import generate_call_summary

logger = logging.getLogger("mykare.agent")

_vad = silero.VAD.load()
_AGENT_NAME = "mia"


def _build_llm():
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        model = settings.llm_model or "gemini-2.0-flash"
        logger.info(f"LLM: Gemini via OpenAI-compat ({model})")
        return openai_plugin.LLM(
            model=model,
            api_key=settings.gemini_api_key or None,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
    model = settings.llm_model or "gpt-4o"
    logger.info(f"LLM: OpenAI ({model})")
    return openai_plugin.LLM(model=model, api_key=settings.openai_api_key or None)


SYSTEM_PROMPT = """You are Mia, a warm and professional AI front-desk assistant for Mykare Health clinic.
Your role is to help patients schedule and manage appointments with our specialist doctors.

OUR MEDICAL DEPARTMENTS & SPECIALISTS:
1. General Medicine     — Dr. Priya Sharma         (Mon–Fri)
2. Cardiology (Heart)   — Dr. Rajesh Nair           (Mon, Wed, Fri)
3. Ophthalmology (Eyes) — Dr. Kavitha Menon         (Mon, Tue, Thu, Fri)
4. Gastroenterology     — Dr. Meera Joshi           (Mon, Wed, Thu, Sat)
5. Pediatrics (Children)— Dr. Sunita Rao            (Mon–Sat)
6. Orthopedics          — Dr. Vikram Patel          (Mon, Wed, Thu)
7. Dermatology (Skin)   — Dr. Ananya Bose           (Tue, Thu, Sat)
8. ENT                  — Dr. Arun Gupta            (Tue, Wed, Fri)
9. Neurology            — Dr. Kiran Reddy           (Mon, Thu, Fri)
10. Gynecology          — Dr. Pooja Singh           (Mon–Fri)

STRICT CONVERSATION FLOW — follow this order every time:
1. Greet and introduce yourself as Mia from Mykare Health.
2. Ask the patient for their EMAIL ADDRESS and PHONE NUMBER to register them.
3. Call identify_user(phone_number, email) immediately — this registers/finds the patient.
4. Ask what health concern or symptom brings them in today.
   Guide them to one of our 10 departments using the examples below:
   - "eyes / vision / sight" → Ophthalmology
   - "heart / chest pain / blood pressure / palpitations" → Cardiology
   - "stomach / digestion / acidity / ulcer / nausea" → Gastroenterology
   - "child / baby / infant / kids" → Pediatrics
   - "bones / joints / back pain / fracture / arthritis" → Orthopedics
   - "skin / rash / acne / hair loss / eczema" → Dermatology
   - "ear / nose / throat / sinus / tonsil / hearing" → ENT
   - "brain / headache / migraine / seizure / vertigo / nerve" → Neurology
   - "women / pregnancy / menstrual / periods / fertility" → Gynecology
   - everything else → General Medicine
5. Call fetch_doctors(specialization=<matched department>) to confirm the right doctor and their available days.
6. Tell the patient which doctor handles that concern and on which days they are available.
7. Ask the patient for their preferred date.
8. Call fetch_slots(date=<YYYY-MM-DD>, doctor_id=<id>) to get available slots.
9. Present at most 5 available time slots naturally (e.g., "9:00 AM, 10:00 AM, 11:00 AM…").
10. If the patient requests a time that is NOT in fetch_slots results — say clearly:
    "I'm sorry, that slot is not available. The open times are: [list again]."
11. Once the patient selects a valid slot, CONFIRM all details aloud:
    "I'll book [patient name] with [doctor name] on [date] at [time]. Shall I confirm?"
12. Call book_appointment() ONLY after the patient says yes/confirm/go ahead.
13. Read the confirmation back: "Booked! Your appointment with [doctor] is confirmed for [date] at [time]. Reference ID: #[id]."
14. Ask if there is anything else you can help with.
15. Call end_conversation() when the patient says goodbye.

FOR CANCELLATION / RESCHEDULING:
- Call retrieve_appointments() to show existing bookings with their IDs.
- Call cancel_appointment(appointment_id) or modify_appointment(appointment_id, new_date, new_time) accordingly.
- Always confirm the cancellation/change before executing.

TOOL USAGE RULES:
- identify_user: ALWAYS call first, pass BOTH phone_number and email
- fetch_categories: use only if patient asks about available departments
- fetch_doctors: after identifying the health concern, pass the specialization name
- fetch_slots: MUST be called before presenting times to verify real-time availability
- book_appointment: ONLY after explicit patient confirmation; include email and category_name
- retrieve_appointments: to show the patient's existing bookings
- cancel_appointment / modify_appointment: after retrieve_appointments gives the IDs
- end_conversation: when patient says goodbye

VOICE RULES:
- Keep responses SHORT (1–3 sentences max) — this is voice, not text
- Never read out long lists; pick the top 5 slots maximum
- Speak naturally; use "AM" / "PM" not 24-hour format when speaking
- Always repeat doctor name, date, and time before confirming a booking
- Today's date: {current_date}"""


_PRICING: dict[str, tuple[float, float]] = {
    "gemini-2.0-flash":  (0.10,  0.40),
    "gemini-1.5-flash":  (0.075, 0.30),
    "gemini-1.5-pro":    (1.25,  5.00),
    "gpt-4o":            (2.50, 10.00),
    "gpt-4o-mini":       (0.15,  0.60),
    "gpt-4-turbo":      (10.00, 30.00),
}


class HealthcareAgent(Agent):
    def __init__(self, room: rtc.Room) -> None:
        current_date = datetime.now().strftime("%Y-%m-%d (%A)")
        super().__init__(instructions=SYSTEM_PROMPT.format(current_date=current_date))
        # Store room directly — self.session.room does NOT exist in livekit-agents 1.x
        self._room = room
        self.transcript: list[dict] = []
        self.booked_appointments: list[dict] = []
        self.user_id: str | None = None
        self.user_email: str | None = None
        self._input_tokens = 0
        self._output_tokens = 0

    # ── Token tracking ────────────────────────────────────────────────────────

    def _on_session_usage(self, ev) -> None:
        """Handle session_usage_updated — the correct token event in livekit-agents 1.5.x."""
        try:
            for mu in ev.usage.model_usage:
                if isinstance(mu, LLMModelUsage):
                    self._input_tokens += mu.input_tokens
                    self._output_tokens += mu.output_tokens
        except Exception:
            pass

    def _cost_usd(self) -> float:
        model = settings.llm_model or (
            "gemini-2.0-flash" if settings.llm_provider == "gemini" else "gpt-4o"
        )
        in_p, out_p = _PRICING.get(model.lower(), (2.50, 10.00))
        return round((self._input_tokens * in_p + self._output_tokens * out_p) / 1_000_000, 6)

    # ── Data channel helpers ──────────────────────────────────────────────────

    async def _pub(self, data: dict) -> None:
        try:
            await self._room.local_participant.publish_data(
                json.dumps(data).encode(), reliable=True
            )
        except Exception as e:
            logger.warning(f"publish_data failed: {e}")

    async def _emit(self, tool: str, status: str, data: dict | None = None) -> None:
        await self._pub({
            "type": "tool_event",
            "tool": tool,
            "status": status,
            "data": data or {},
            "timestamp": datetime.now().isoformat(),
        })

    # ── Tools ─────────────────────────────────────────────────────────────────

    @function_tool
    async def identify_user(
        self,
        phone_number: Annotated[str, "Patient's phone number, digits only, e.g. 9876543210"],
        email: Annotated[str, "Patient's email address, e.g. john@gmail.com"] = "",
    ) -> str:
        """Identify or register a patient by phone number and email. Always call this first."""
        await self._emit("identify_user", "calling", {"phone_number": phone_number, "email": email})
        result = await tool_funcs.identify_user(phone_number, email)
        self.user_id = phone_number
        self.user_email = email or result.get("email") or ""
        await self._emit("identify_user", "success", result)
        if result["found"]:
            name = result["name"] or "there"
            return f"Patient recognized: {name} (phone: {phone_number}, email: {result.get('email') or 'not on file'}). How can I help you today?"
        return f"New patient registered — phone: {phone_number}, email: {email or 'not provided'}. May I have your full name please?"

    @function_tool
    async def fetch_categories(self) -> str:
        """List all available medical departments."""
        await self._emit("fetch_categories", "calling", {})
        categories = await tool_funcs.fetch_categories()
        await self._emit("fetch_categories", "success", {"categories": categories})
        lines = "; ".join(f"{c['icon']} {c['display_name']}" for c in categories)
        return f"Our departments: {lines}. Which area applies to your concern?"

    @function_tool
    async def fetch_doctors(
        self,
        specialization: Annotated[str, "Department name, e.g. 'Cardiology', 'Ophthalmology'."] = "",
    ) -> str:
        """Fetch available doctors filtered by specialization."""
        await self._emit("fetch_doctors", "calling", {"specialization": specialization})
        doctors = await tool_funcs.fetch_doctors(specialization or None)
        await self._emit("fetch_doctors", "success", {"doctors": doctors})
        if not doctors:
            return f"No doctors found for '{specialization}'. Try 'General Medicine'."
        lines = "; ".join(
            f"{d['name']} ({d['specialization']}, available {', '.join(d['available_days'][:3])}"
            f"{'…' if len(d['available_days']) > 3 else ''})"
            for d in doctors
        )
        return f"Doctor(s) for {specialization}: {lines}. Ask the patient for their preferred date."

    @function_tool
    async def fetch_slots(
        self,
        date: Annotated[str, "Date in YYYY-MM-DD format"],
        doctor_id: Annotated[int, "Doctor ID from fetch_doctors. Use 0 if unknown."] = 0,
    ) -> str:
        """Fetch available appointment slots for a specific doctor on a given date."""
        await self._emit("fetch_slots", "calling", {"date": date, "doctor_id": doctor_id})
        slots = await tool_funcs.fetch_slots(date, doctor_id or None)
        await self._emit("fetch_slots", "success", {"date": date, "available_slots": slots})
        if not slots:
            return f"No slots available on {date}. Ask the patient to try another date."
        def to_ampm(t: str) -> str:
            h, m = map(int, t.split(":"))
            return f"{h % 12 or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"
        readable = ", ".join(to_ampm(s) for s in slots[:6])
        more = f" and {len(slots) - 6} more" if len(slots) > 6 else ""
        return f"Available times on {date}: {readable}{more}. Which time works best?"

    @function_tool
    async def book_appointment(
        self,
        name: Annotated[str, "Patient's full name"],
        phone_number: Annotated[str, "Patient's phone number"],
        date: Annotated[str, "Appointment date in YYYY-MM-DD format"],
        time: Annotated[str, "Appointment time in HH:MM 24-hour format, e.g. 10:30"],
        doctor_id: Annotated[int, "Doctor ID from fetch_doctors. Use 0 if not specified."] = 0,
        doctor_name: Annotated[str, "Doctor's full name"] = "",
        email: Annotated[str, "Patient's email address"] = "",
        category_name: Annotated[str, "Medical department, e.g. 'Cardiology'"] = "",
        notes: Annotated[str, "Reason for visit or special notes"] = "",
    ) -> str:
        """Book an appointment after the patient has confirmed all details."""
        uid = self.user_id or phone_number
        uemail = email or self.user_email or ""
        await self._emit("book_appointment", "calling", {
            "name": name, "date": date, "time": time,
            "doctor_name": doctor_name, "category_name": category_name,
        })
        result = await tool_funcs.book_appointment(
            uid, name, phone_number, date, time,
            email=uemail, notes=notes,
            doctor_id=doctor_id or None,
            doctor_name=doctor_name or None,
            category_name=category_name or None,
        )
        if result["success"]:
            self.booked_appointments.append(result)
            await self._emit("book_appointment", "success", result)
            doc_part = f" with {doctor_name}" if doctor_name else ""
            cat_part = f" ({category_name})" if category_name else ""
            return (
                f"Booked! {name}, your appointment{doc_part}{cat_part} is confirmed "
                f"for {date} at {time}. Reference ID: #{result['appointment_id']}."
            )
        await self._emit("book_appointment", "error", result)
        return f"Sorry, {result['error']} Please choose one of the available times."

    @function_tool
    async def retrieve_appointments(self) -> str:
        """Retrieve all appointments for the current patient."""
        if not self.user_id:
            return "Let me get your phone number first."
        await self._emit("retrieve_appointments", "calling", {"user_id": self.user_id})
        appts = await tool_funcs.retrieve_appointments(self.user_id)
        await self._emit("retrieve_appointments", "success", {"appointments": appts})
        if not appts:
            return "You have no appointments on record. Would you like to book one?"
        confirmed = [a for a in appts if a["status"] == "confirmed"]
        if not confirmed:
            return "All your previous appointments have been cancelled."
        lines = "; ".join(
            f"#{a['id']} — {a['date']} at {a['time']}"
            + (f" with {a['doctor_name']}" if a.get("doctor_name") else "")
            + (f" ({a['category_name']})" if a.get("category_name") else "")
            for a in confirmed[:3]
        )
        return f"You have {len(confirmed)} upcoming appointment(s): {lines}."

    @function_tool
    async def cancel_appointment(
        self,
        appointment_id: Annotated[int, "The numeric appointment ID from retrieve_appointments"],
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
        result = await tool_funcs.modify_appointment(
            appointment_id, self.user_id, new_date, new_time
        )
        status = "success" if result["success"] else "error"
        await self._emit("modify_appointment", status, result)
        return result.get("message") or result.get("error", "An error occurred.")

    @function_tool
    async def end_conversation(self) -> str:
        """End the conversation and generate a call summary. Call when the patient says goodbye."""
        await self._emit("end_conversation", "calling", {})
        summary = await generate_call_summary(self.transcript, self.booked_appointments)

        # Merge summary-generation tokens
        st = summary.pop("_summary_tokens", {})
        self._input_tokens  += st.get("prompt_tokens", 0)
        self._output_tokens += st.get("completion_tokens", 0)

        model = settings.llm_model or (
            "gemini-2.0-flash" if settings.llm_provider == "gemini" else "gpt-4o"
        )
        summary["tokens_used"] = {
            "prompt_tokens":    self._input_tokens,
            "completion_tokens": self._output_tokens,
            "total_tokens":     self._input_tokens + self._output_tokens,
        }
        summary["estimated_cost_usd"] = self._cost_usd()
        summary["model"]    = model
        summary["provider"] = settings.llm_provider

        sheets_saved = False
        if settings.google_sheet_id and settings.google_service_account_json:
            from .sheets import save_summary
            sheets_saved = await save_summary(
                summary, settings.google_sheet_id, settings.google_service_account_json
            )
        summary["sheets_saved"] = sheets_saved

        # Save to call history DB
        try:
            await tool_funcs.save_call_session(self._room.name, summary)
        except Exception as e:
            logger.warning(f"Failed to save call session: {e}")

        await self._emit("end_conversation", "success", summary)
        await self._pub({
            "type": "call_summary",
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
        })
        return (
            "It was a pleasure helping you today! Your appointment details are all saved. "
            "Take care and have a wonderful day!"
        )


async def entrypoint(ctx: JobContext) -> None:
    await init_db()
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Room connected: {ctx.room.name}")

    session = AgentSession(
        stt=deepgram.STT(api_key=settings.deepgram_api_key, language="en-US"),
        llm=_build_llm(),
        tts=deepgram.TTS(api_key=settings.deepgram_api_key),
        vad=_vad,
    )

    # Pass ctx.room directly — avoids the broken self.session.room pattern
    agent = HealthcareAgent(ctx.room)

    # Token tracking via the correct 1.5.x event
    session.on("session_usage_updated", agent._on_session_usage)

    # User speech → transcript
    @session.on("user_input_transcribed")
    def on_user_input(ev) -> None:
        if ev.is_final:
            agent.transcript.append({"role": "user", "content": ev.transcript})
            asyncio.ensure_future(agent._pub({
                "type": "transcript", "role": "user",
                "content": ev.transcript, "timestamp": datetime.now().isoformat(),
            }))

    # Agent speech → transcript (conversation_item_added fires for every LLM output)
    @session.on("conversation_item_added")
    def on_item_added(ev) -> None:
        try:
            item = ev.item
            if getattr(item, "role", None) == "assistant":
                text = item.text_content  # @property on ChatMessage
                if text:
                    agent.transcript.append({"role": "assistant", "content": text})
                    asyncio.ensure_future(agent._pub({
                        "type": "transcript", "role": "assistant",
                        "content": text, "timestamp": datetime.now().isoformat(),
                    }))
        except Exception:
            pass

    await session.start(room=ctx.room, agent=agent)

    GREETING = (
        "Hello! Welcome to Mykare Health. I'm Mia, your AI front-desk assistant. "
        "I'm here to help you book appointments with our specialist doctors. "
        "To get started, could you please share your email address and phone number?"
    )
    await session.say(GREETING, allow_interruptions=True)
    # Publish greeting manually since session.say() bypasses the LLM pipeline
    agent.transcript.append({"role": "assistant", "content": GREETING})
    asyncio.ensure_future(agent._pub({
        "type": "transcript", "role": "assistant",
        "content": GREETING, "timestamp": datetime.now().isoformat(),
    }))


def run_worker() -> None:
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=_AGENT_NAME,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
            ws_url=settings.livekit_url,
        )
    )


if __name__ == "__main__":
    run_worker()
