import json
from openai import AsyncOpenAI

from .config import settings

_client = AsyncOpenAI(api_key=settings.openai_api_key)


async def generate_call_summary(transcript: list[dict], appointments: list[dict]) -> dict:
    transcript_text = "\n".join(
        f"{msg['role'].upper()}: {msg['content']}" for msg in transcript
    )
    appt_text = json.dumps(appointments, indent=2) if appointments else "None"

    prompt = f"""Analyze this healthcare front-desk AI conversation and return a JSON summary.

TRANSCRIPT:
{transcript_text}

APPOINTMENT ACTIONS:
{appt_text}

Return ONLY valid JSON with these exact keys:
{{
  "summary": "2-3 sentence overview",
  "user_name": "patient name or null",
  "phone_number": "phone number or null",
  "intent": "booking|cancellation|modification|inquiry|mixed",
  "appointments": [list of appointment objects with date/time/status],
  "user_preferences": ["any noted preferences like doctor, morning slots, etc"],
  "follow_up_needed": true|false,
  "sentiment": "positive|neutral|negative",
  "call_duration_estimate": "approximate conversation length"
}}"""

    try:
        response = await _client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(response.choices[0].message.content)
    except Exception:
        return {
            "summary": "Call completed. See appointments list for details.",
            "user_name": None,
            "phone_number": None,
            "intent": "unknown",
            "appointments": appointments,
            "user_preferences": [],
            "follow_up_needed": False,
            "sentiment": "neutral",
            "call_duration_estimate": "unknown",
        }
