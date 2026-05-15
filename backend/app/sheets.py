"""
Google Sheets integration for saving call summaries.

Setup:
  1. Create a Google Sheet and note its ID (from the URL)
  2. In Google Cloud Console, create a Service Account and download the JSON key
  3. Share your sheet with the service account's email address (editor access)
  4. Add to .env:
       GOOGLE_SHEET_ID=your_sheet_id_here
       GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   ← full JSON as one line
"""
import json
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

_HEADERS = [
    "Timestamp", "Patient Name", "Phone Number", "Intent",
    "Sentiment", "Doctor(s)", "Appointments", "Follow-up Needed",
    "Summary", "Call Duration",
]


def _write_sync(sheet_id: str, creds_json: str, row: list) -> None:
    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(sheet_id)

    try:
        ws = sh.worksheet("Call Summaries")
    except Exception:
        ws = sh.add_worksheet("Call Summaries", rows=1000, cols=len(_HEADERS))
        ws.append_row(_HEADERS)

    ws.append_row(row)


async def save_summary(summary: dict, sheet_id: str, creds_json: str) -> bool:
    """Append one call summary row to the Google Sheet. Returns True on success."""
    appts = summary.get("appointments") or []
    doctors = sorted({
        a.get("doctor_name", "")
        for a in appts
        if isinstance(a, dict) and a.get("doctor_name")
    })
    appt_strs = [
        f"{a.get('date','')} {a.get('time','')} ({a.get('status','')})"
        for a in appts
        if isinstance(a, dict)
    ]

    row = [
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        summary.get("user_name") or "",
        summary.get("phone_number") or "",
        summary.get("intent") or "",
        summary.get("sentiment") or "",
        ", ".join(filter(None, doctors)),
        " | ".join(appt_strs),
        "Yes" if summary.get("follow_up_needed") else "No",
        summary.get("summary") or "",
        summary.get("call_duration_estimate") or "",
    ]

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _write_sync, sheet_id, creds_json, row)
        logger.info("Call summary saved to Google Sheets")
        return True
    except ImportError:
        logger.warning("gspread not installed — run: pip install gspread google-auth")
        return False
    except Exception as e:
        logger.error(f"Google Sheets save failed: {e}")
        return False
