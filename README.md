# Mykare Health — AI Voice Agent

A production-ready, web-based AI voice agent for healthcare front-desk operations. Patients can call in, speak naturally, and book, modify, or cancel appointments — all handled by an AI that understands context, prevents double-bookings, and summarises every call.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                               │
│                                                                     │
│  ┌─────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Transcript │  │  Avatar (canvas)     │  │  Live Activity     │  │
│  │  Panel      │  │  mouth synced to TTS │  │  (tool events)     │  │
│  └─────────────┘  │  + Calendar View     │  └────────────────────┘  │
│                   └──────────────────────┘                          │
│                           │                                         │
│               livekit-client (WebRTC)                               │
└───────────────────────────┼─────────────────────────────────────────┘
                            │  WebRTC audio + data channel
┌───────────────────────────▼─────────────────────────────────────────┐
│                     LIVEKIT CLOUD (SFU)                             │
│               Routes audio & data between participants              │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │ WebSocket                    │ REST
           │                              │
┌──────────▼────────────┐   ┌────────────▼──────────────────────────┐
│   AGENT WORKER        │   │   FASTAPI REST API                    │
│   (Docker container)  │   │   (Docker / AWS Lambda)               │
│                       │   │                                       │
│  Deepgram STT ──┐     │   │  POST /token        → LiveKit JWT     │
│                 ▼     │   │  GET  /categories   → 10 departments  │
│  GPT-4o LLM ◄──►Tools│   │  GET  /doctors      → doctor list     │
│  (OpenAI)       │     │   │  GET  /slots        → available times │
│                 ▼     │   │  GET  /availability → monthly map     │
│  Cartesia TTS ──┘     │   │  GET  /appointments/:phone            │
│                       │   │  POST /appointments                   │
│  Data channel:        │   │  DELETE /appointments/:id             │
│  • transcript lines   │   │  POST /summary      → GPT-4o summary  │
│  • tool events        │   │  GET  /sessions     → call history    │
│  • call summary       │   │                                       │
└───────────────────────┘   └───────────────────────────────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │  SQLITE DB  │
                                   │  (or Supabase│
                                   │  Postgres)  │
                                   └─────────────┘
```

### Call Flow (step by step)

```
1.  User opens browser → clicks "Start Call"
2.  Frontend POSTs to /token → gets LiveKit JWT
3.  Frontend connects to LiveKit Cloud room via WebRTC
4.  LiveKit dispatches a job to the Agent Worker
5.  Agent greets the user (Cartesia TTS → audio → LiveKit → browser)
6.  User speaks → Deepgram STT transcribes → text sent to GPT-4o
7.  GPT-4o decides which tool to call (or what to say)
8.  Tool result → GPT-4o generates reply text
9.  Cartesia TTS converts reply → audio sent back to browser
10. Agent publishes transcript lines + tool events via LiveKit data channel
11. Frontend receives data packets → updates transcript + Live Activity in real time
12. Agent calls end_conversation → generates JSON call summary
13. Summary sent via data channel → frontend shows summary modal
14. Session saved to call_sessions table → visible in Call History
```

### Tool Calling Flow

```
User: "I want to book a cardiology appointment for tomorrow at 10am"

GPT-4o decides:
  1. identify_user(phone_number)           → check/create patient record
  2. fetch_categories()                    → list available departments
  3. fetch_doctors(category_id=2)          → Dr. Rajesh Nair (Cardiology)
  4. fetch_slots("2026-05-17", doctor_id=2)→ confirm 10:00 is free
  5. book_appointment(name, phone,
                      date, time,
                      doctor_id, category) → insert row, prevent conflicts
  6. [speaks confirmation to user]
  7. end_conversation()                    → generate + send summary
                                           → save to call_sessions table
```

Each tool call triggers a real-time event on the frontend:
- **Calling** → amber spinner
- **Success** → teal checkmark + result data snippet
- **Error** → red cross + error message

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| STT (Speech-to-Text) | [Deepgram](https://deepgram.com) |
| LLM | [OpenAI GPT-4o](https://platform.openai.com) |
| TTS (Text-to-Speech) | [Cartesia](https://cartesia.ai) |
| Voice Agent Framework | [LiveKit Agents 1.5.x](https://docs.livekit.io/agents) |
| WebRTC Infrastructure | [LiveKit Cloud](https://cloud.livekit.io) |
| Avatar | Custom canvas animation (60fps, mouth synced to audio via Web Audio API) |
| Backend API | Python FastAPI + Mangum (Lambda adapter) |
| Database | SQLite (dev) / Supabase PostgreSQL (prod) via SQLAlchemy async |
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Deployment | Docker Compose + Serverless Framework (AWS) |

---

## Features

### Voice & AI
- **Natural conversation** — patients speak freely; GPT-4o understands context across turns
- **Real-time transcript** — every user and AI utterance appears in the chat panel as it happens
- **Live activity feed** — every tool call (identify, fetch slots, book, etc.) shown with live status
- **Mouth-sync avatar** — canvas animation driven by Web Audio API frequency analysis
- **Mute / unmute** — microphone toggle without dropping the call

### Appointments
- **10 medical departments** — General Medicine, Cardiology, Ophthalmology, Gastroenterology, Pediatrics, Orthopedics, Dermatology, ENT, Neurology, Gynecology
- **10 specialist doctors** — one per department, each with individual weekly schedules and time slots
- **Conflict-free booking** — slot availability checked per doctor before confirming
- **Modify & cancel** — full rescheduling with conflict detection

### Calendar View
- **Monthly availability grid** — colour-coded by slot count per day
- **Department filter** — filter availability by any of the 10 categories
- **Slot inspector** — click a date to see exact available time slots
- **Patient appointment highlights** — patient's own bookings marked once identified

### Call Summary & History
- **Auto-generated summary** — GPT-4o JSON summary at end of call (intent, sentiment, appointments, preferences, follow-up flag)
- **Token & cost tracking** — input/output tokens and estimated USD cost per call
- **Google Sheets export** — summary automatically saved to a configured spreadsheet (optional)
- **Call History panel** — browse all past Mia sessions with patient name, intent, sentiment, cost, and a "Summary" button to re-open the full modal

---

## Project Structure

```
Voice_agents/
├── .env.example                  ← Root env template (for docker-compose)
├── docker-compose.yml            ← All 3 services wired together
├── README.md
│
├── backend/
│   ├── app/
│   │   ├── agent.py              ← LiveKit voice agent "Mia" + all tools
│   │   │                           Uses ctx.room directly; publishes transcript,
│   │   │                           tool events, and call summary via data channel
│   │   ├── main.py               ← FastAPI REST API (10 endpoints)
│   │   ├── tools.py              ← DB tool implementations + save_call_session
│   │   ├── database.py           ← SQLAlchemy models:
│   │   │                             User, Appointment, Doctor, Category,
│   │   │                             CallSession
│   │   ├── summary.py            ← GPT-4o call summary generator (JSON structured)
│   │   ├── sheets.py             ← Google Sheets integration (optional)
│   │   └── config.py             ← Pydantic settings from .env
│   ├── Dockerfile                ← FastAPI API container
│   ├── Dockerfile.agent          ← LiveKit agent worker container
│   ├── serverless.yml            ← Serverless Framework config (AWS Lambda)
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Avatar.tsx          ← 60fps canvas face: blinks, mouth synced to TTS audio
    │   │   ├── VoiceInterface.tsx  ← Landing page + in-call 3-panel layout + controls
    │   │   ├── TranscriptPanel.tsx ← Live conversation history (user + Mia bubbles)
    │   │   ├── ToolStatus.tsx      ← Live tool call activity feed (calling/success/error)
    │   │   ├── CallSummary.tsx     ← End-of-call summary modal (intent, sentiment,
    │   │   │                          appointments, tokens used, cost, Sheets badge)
    │   │   ├── CallHistory.tsx     ← Call history modal: session list + summary viewer
    │   │   └── CalendarView.tsx    ← Monthly availability calendar with dept filter
    │   ├── hooks/
    │   │   └── useVoiceAgent.ts    ← LiveKit room, audio analyser, transcript/tool/
    │   │                              summary state, auto-summary fallback on hang-up
    │   └── lib/
    │       └── api.ts              ← Backend API client (axios) — all types exported
    ├── Dockerfile                  ← Multi-stage build → nginx
    └── nginx.conf
```

---

## Database Models

| Table | Purpose |
|-------|---------|
| `users` | Patient records (phone, name, email) |
| `categories` | 10 medical departments with icons |
| `doctors` | 10 specialists with weekly schedules and time slots |
| `appointments` | Booked/cancelled appointments linked to user + doctor + category |
| `call_sessions` | Every completed call: summary text, full summary JSON, tokens, cost |

The database auto-seeds on first start with all 10 categories and doctors.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- API keys for: LiveKit Cloud, Deepgram, Cartesia, OpenAI

---

## Step-by-Step Setup

### 1. Clone / open the project

```bash
cd Voice_agents
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in all keys:

| Variable | Where to get it |
|----------|----------------|
| `LIVEKIT_URL` | [cloud.livekit.io](https://cloud.livekit.io) → your project → Settings → Keys |
| `LIVEKIT_API_KEY` | same page |
| `LIVEKIT_API_SECRET` | same page |
| `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) → API Keys |
| `CARTESIA_API_KEY` | [play.cartesia.ai](https://play.cartesia.ai) → Account → API Keys |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `DATABASE_URL` | Leave as default for local SQLite |

### 3. Run with Docker Compose

```bash
docker-compose up --build
```

This starts three containers:

| Container | Purpose | Port |
|-----------|---------|------|
| `mykare-api` | FastAPI REST API | `8000` |
| `mykare-agent` | LiveKit voice agent worker | — (outbound only) |
| `mykare-frontend` | React app served by nginx | `3000` |

Open **http://localhost:3000** in your browser.

### 4. Make a test call

1. Click **Start Call** — the browser will ask for microphone permission
2. Wait for Mia to greet you
3. Say: *"Hi, my number is 9876543210 and email is test@example.com, I want to book a cardiology appointment"*
4. Follow the conversation to pick a doctor, date, and time
5. Say *"That's all, goodbye"* to trigger the call summary
6. After the call ends, click **Call History** in the navbar to see the session logged

---

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/token` | Create LiveKit JWT + dispatch agent to room |
| `GET` | `/health` | Health check |
| `GET` | `/categories` | List all 10 medical departments |
| `GET` | `/doctors` | List doctors (filter by `specialization` or `category_id`) |
| `GET` | `/slots` | Available time slots for a date (filter by `doctor_id` or `category_id`) |
| `GET` | `/availability` | Slot count per day for a year/month (for calendar) |
| `GET` | `/appointments/:phone` | All appointments for a patient |
| `POST` | `/appointments` | Create appointment (conflict-checked) |
| `DELETE` | `/appointments/:id` | Cancel appointment |
| `POST` | `/summary` | Generate GPT-4o call summary from transcript |
| `GET` | `/sessions` | List all call sessions (newest first, `?limit=50`) |

---

## Supported Tools (Agent Capabilities)

| Tool | What it does |
|------|-------------|
| `identify_user` | Looks up or registers a patient by phone number and email |
| `fetch_categories` | Returns all 10 medical departments with icons |
| `fetch_doctors` | Lists doctors, optionally filtered by category |
| `fetch_slots` | Returns available times for a date (per doctor or category) |
| `book_appointment` | Saves appointment to DB, prevents double-booking |
| `retrieve_appointments` | Lists all appointments for the current patient |
| `cancel_appointment` | Marks an appointment as cancelled |
| `modify_appointment` | Reschedules to a new date/time (checks conflicts) |
| `end_conversation` | Generates GPT-4o JSON summary → sends to frontend → saves session |

---

## Deployment

### Option A — Docker Compose on a VPS (simplest)

```bash
# On your server (e.g. Ubuntu on AWS EC2 / DigitalOcean)
git clone <your-repo>
cd Voice_agents
cp .env.example .env && nano .env   # fill in keys
docker-compose up -d --build
```

> Point a domain at port 3000 via nginx/Caddy reverse proxy + HTTPS (required for microphone access in production).

### Option B — Serverless REST API + Docker Agent

The REST API is stateless and can run on AWS Lambda. The agent worker must run as a persistent container (it holds a WebSocket to LiveKit Cloud).

**Deploy REST API to Lambda:**
```bash
cd backend
npm install -g serverless
export LIVEKIT_URL=...  OPENAI_API_KEY=...  # etc.
serverless deploy --region us-east-1
```

**Deploy agent worker** on Railway / Fly.io / AWS ECS using `Dockerfile.agent`:
```bash
# Example: Railway
railway up --dockerfile backend/Dockerfile.agent
```

---

## Environment Variables Reference

### Root `.env` (used by docker-compose)

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPGRAM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CARTESIA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=sqlite+aiosqlite:///./appointments.db

# Optional — Google Sheets integration
GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

### Frontend `.env` (only needed for local dev outside Docker)

```env
VITE_API_URL=http://localhost:8000
```

---

## Local Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys

# Terminal 1 — REST API
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Agent worker
python -m app.agent dev
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:8000
npm run dev   # → http://localhost:5173
```

---

## Cost Estimate per Call (~5 min)

| Service | Usage | Est. Cost |
|---------|-------|----------|
| Deepgram STT | ~300 words | ~$0.004 |
| Cartesia TTS | ~200 words | ~$0.003 |
| OpenAI GPT-4o | ~3–5k tokens | ~$0.02–0.05 |
| LiveKit Cloud | 5 min audio | ~$0.003 |
| **Total** | | **~$0.03–0.06 / call** |

Exact token usage and USD cost are shown in the Call Summary modal and stored in the `call_sessions` table for every call.
