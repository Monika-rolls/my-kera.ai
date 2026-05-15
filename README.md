# Mykare Health — AI Voice Agent

A production-ready, web-based AI voice agent for healthcare front-desk operations. Patients can call in, speak naturally, and book, modify, or cancel appointments — all handled by an AI that understands context, prevents double-bookings, and summarises every call.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Transcript  │  │ Avatar (canvas│  │  Tool Activity Feed  │  │
│  │    Panel     │  │  + audio sync)│  │  (live tool events)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                          │                                      │
│              livekit-client (WebRTC)                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │  WebRTC audio + data channel
┌──────────────────────────▼──────────────────────────────────────┐
│                    LIVEKIT CLOUD (SFU)                          │
│              Routes audio & data between participants           │
└──────────┬──────────────────────────────┬───────────────────────┘
           │ WebSocket                    │ REST
           │                              │
┌──────────▼────────────┐   ┌────────────▼────────────────────────┐
│   AGENT WORKER        │   │   FASTAPI REST API                  │
│   (Docker container)  │   │   (Docker / AWS Lambda)             │
│                       │   │                                     │
│  Deepgram STT ──┐     │   │  POST /token   → LiveKit JWT        │
│                 ▼     │   │  GET  /appointments/:phone          │
│  GPT-4o LLM ◄──►Tools│   │  POST /appointments                 │
│  (OpenAI)       │     │   │  DELETE /appointments/:id           │
│                 ▼     │   │  POST /summary → GPT-4o summary     │
│  Cartesia TTS ──┘     │   │                                     │
│                       │   └─────────────────────────────────────┘
│  Tool events sent     │              │
│  via data channel ────┼──────────────┘
│                       │              │
└───────────────────────┘        ┌─────▼──────┐
                                 │  SQLITE DB │
                                 │  (or Supabase│
                                 │  Postgres) │
                                 └────────────┘
```

### Call Flow (step by step)

```
1. User opens browser → clicks "Start Call"
2. Frontend POSTs to /token → gets LiveKit JWT
3. Frontend connects to LiveKit Cloud room via WebRTC
4. LiveKit dispatches a job to the Agent Worker
5. Agent greets the user (Cartesia TTS → audio → LiveKit → browser)
6. User speaks → Deepgram STT transcribes → text sent to GPT-4o
7. GPT-4o decides which tool to call (or what to say)
8. Tool result → GPT-4o generates reply text
9. Cartesia TTS converts reply → audio sent back to browser
10. Agent publishes tool events over LiveKit data channel
11. Frontend receives data packets → updates UI in real time
12. Agent calls end_conversation → GPT-4o generates JSON summary
13. Summary sent via data channel → frontend shows summary modal
```

### Tool Calling Flow

```
User: "I'd like to book an appointment for tomorrow at 10am"

GPT-4o decides:
  1. identify_user(phone_number)        → check/create patient record
  2. fetch_slots("2025-04-30")          → confirm 10:00 is free
  3. book_appointment(name, phone,      → insert row, prevent conflicts
                      date, time)
  4. [speaks confirmation to user]
  5. end_conversation()                 → generate + send summary
```

Each tool call triggers a real-time event on the frontend:
- **Calling** → amber spinner
- **Success** → teal checkmark + result data
- **Error** → red cross + error message

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| STT (Speech-to-Text) | [Deepgram](https://deepgram.com) |
| LLM | [OpenAI GPT-4o](https://platform.openai.com) |
| TTS (Text-to-Speech) | [Cartesia](https://cartesia.ai) |
| Voice Agent Framework | [LiveKit Agents](https://docs.livekit.io/agents) |
| WebRTC Infrastructure | [LiveKit Cloud](https://cloud.livekit.io) |
| Avatar | Custom canvas animation (no external API) |
| Backend API | Python FastAPI + Mangum (Lambda adapter) |
| Database | SQLite (dev) / Supabase PostgreSQL (prod) |
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Deployment | Docker Compose + Serverless Framework (AWS) |

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
│   │   ├── agent.py              ← LiveKit voice agent "Mia" + all 7 tools
│   │   ├── main.py               ← FastAPI REST endpoints
│   │   ├── tools.py              ← DB tool implementations (book/cancel/etc.)
│   │   ├── database.py           ← SQLAlchemy models (User, Appointment)
│   │   ├── summary.py            ← GPT-4o call summary generator
│   │   └── config.py             ← Pydantic settings from .env
│   ├── Dockerfile                ← FastAPI API container
│   ├── Dockerfile.agent          ← LiveKit agent worker container
│   ├── serverless.yml            ← Serverless Framework config (AWS Lambda)
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Avatar.tsx         ← 60fps canvas face: blinks, mouth synced to audio
    │   │   ├── VoiceInterface.tsx ← Main 3-panel layout + call controls
    │   │   ├── ToolStatus.tsx     ← Live tool call activity feed
    │   │   ├── TranscriptPanel.tsx← Conversation history (user + AI bubbles)
    │   │   └── CallSummary.tsx    ← End-of-call summary modal
    │   ├── hooks/
    │   │   └── useVoiceAgent.ts   ← LiveKit room, audio analyser, data events
    │   └── lib/
    │       └── api.ts             ← Backend API client (axios)
    ├── Dockerfile                 ← Multi-stage build → nginx
    └── nginx.conf
```

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
3. Say: *"Hi, my number is 9876543210, I want to book an appointment"*
4. Follow the conversation to book, check, or cancel
5. Say *"That's all, goodbye"* to trigger the call summary

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

The REST API (`/token`, `/appointments`, `/summary`) can run on AWS Lambda — it's stateless and fast.
The agent worker **must** run as a persistent container (it holds a WebSocket to LiveKit Cloud).

**Deploy REST API to Lambda:**
```bash
cd backend
npm install -g serverless
# Set env vars in AWS SSM or export them locally:
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
```

### Frontend `.env` (only needed for local dev outside Docker)

```env
VITE_API_URL=http://localhost:8000
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
```

---

## Supported Tools (Agent Capabilities)

| Tool | What it does |
|------|-------------|
| `identify_user` | Looks up or registers a patient by phone number |
| `fetch_slots` | Returns available appointment times for a date |
| `book_appointment` | Saves appointment to DB, prevents double-booking |
| `retrieve_appointments` | Lists all appointments for the current patient |
| `cancel_appointment` | Marks an appointment as cancelled |
| `modify_appointment` | Reschedules to a new date/time (checks conflicts) |
| `end_conversation` | Generates GPT-4o JSON summary, sends to frontend |

---

## Cost Estimate per Call (~5 min)

| Service | Usage | Est. Cost |
|---------|-------|----------|
| Deepgram STT | ~300 words | ~$0.004 |
| Cartesia TTS | ~200 words | ~$0.003 |
| OpenAI GPT-4o | ~2k tokens | ~$0.01 |
| LiveKit Cloud | 5 min audio | ~$0.003 |
| **Total** | | **~$0.02 / call** |

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
npm run dev   # → http://localhost:3000
```
