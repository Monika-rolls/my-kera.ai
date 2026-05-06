# Mykare Health — AI Voice Agent (Backend)

A Python backend powering an AI voice agent for healthcare appointment management.
The frontend is built separately in **Lovable** using the spec in `frontend.md`.

---

## Repository Structure

```
Voice_agents/
├── backend/
│   ├── app/
│   │   ├── agent.py        ← LiveKit voice agent (Mia) + all 7 tools
│   │   ├── main.py         ← FastAPI REST API
│   │   ├── tools.py        ← DB tool implementations
│   │   ├── database.py     ← SQLAlchemy models (User, Appointment)
│   │   ├── summary.py      ← Call summary generator (via configured LLM)
│   │   └── config.py       ← Pydantic settings from .env
│   ├── api/
│   │   └── index.py        ← Vercel serverless entry point
│   ├── Dockerfile           ← FastAPI API container
│   ├── Dockerfile.agent     ← LiveKit agent worker container
│   ├── vercel.json          ← Vercel deployment config
│   └── serverless.yml       ← AWS Lambda alternative
├── .env.example             ← All environment variables (template)
├── docker-compose.yml       ← Local dev (API + agent together)
├── frontend.md              ← Frontend spec for Lovable
└── README.md
```

---

## Architecture

```
Lovable Frontend (Vercel)
        │
        │  REST API calls          LiveKit WebRTC (voice + data)
        ▼                                    ▼
┌──────────────────┐           ┌─────────────────────────┐
│  FastAPI REST    │           │   LiveKit Agent Worker   │
│  (Vercel)        │           │   (Railway / Render)     │
│                  │           │                          │
│  POST /token     │           │  Deepgram  → STT         │
│  GET  /appts     │           │  OpenAI or Gemini → LLM  │
│  POST /appts     │           │  Cartesia  → TTS         │
│  DELETE /appts   │           │  7 tools   → DB          │
│  POST /summary   │           └─────────────────────────┘
└──────────┬───────┘                        │
           │                                │
           └──────────┬─────────────────────┘
                      ▼
              ┌───────────────┐
              │  Supabase DB  │
              │  (PostgreSQL) │
              └───────────────┘
```

> **Important:** The FastAPI REST API is stateless → deploys to Vercel.
> The LiveKit agent worker holds a persistent WebSocket → deploys to Railway/Render.
> Both share the same database.

---

## Environment Variables

Create `backend/.env` (copy from `.env.example` and fill in your keys):

### Required for both API and agent

| Variable | Where to get it |
|----------|----------------|
| `LIVEKIT_URL` | [cloud.livekit.io](https://cloud.livekit.io) → Project → Settings → Keys |
| `LIVEKIT_API_KEY` | same page |
| `LIVEKIT_API_SECRET` | same page |

### LLM provider — choose one

**Option A — OpenAI (default)**

| Variable | Where to get it |
|----------|----------------|
| `LLM_PROVIDER` | Set to `openai` |
| `LLM_MODEL` | Optional — defaults to `gpt-4o` |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

**Option B — Gemini**

| Variable | Where to get it |
|----------|----------------|
| `LLM_PROVIDER` | Set to `gemini` |
| `LLM_MODEL` | Optional — defaults to `gemini-2.0-flash` |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API key |

### Agent-only (not required by the REST API / Vercel)

| Variable | Where to get it |
|----------|----------------|
| `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) → API Keys |
| `CARTESIA_API_KEY` | [play.cartesia.ai](https://play.cartesia.ai) → Account → API Keys |

### Database

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | SQLite (dev): `sqlite+aiosqlite:///./appointments.db` |
| | Supabase (prod): `postgresql+asyncpg://postgres:[pwd]@db.[ref].supabase.co:5432/postgres` |

---

## Local Development (no Docker)

### 1. Set up the virtual environment

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements-agent.txt
```

> Use `requirements-agent.txt` — it includes everything needed for both the REST API and the agent worker.

### 2. Create your `.env`

```bash
cp .env.example .env
```

Fill in your LiveKit keys and choose your LLM provider (see env vars table above).

**Example `.env` for Gemini:**
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret

LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash
GEMINI_API_KEY=AIza...

DEEPGRAM_API_KEY=your-deepgram-key
CARTESIA_API_KEY=sk_car_...

DATABASE_URL=sqlite+aiosqlite:///./appointments.db
```

**Example `.env` for OpenAI:**
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret

LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-proj-...

DEEPGRAM_API_KEY=your-deepgram-key
CARTESIA_API_KEY=sk_car_...

DATABASE_URL=sqlite+aiosqlite:///./appointments.db
```

### 3. Terminal 1 — REST API

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

### 4. Terminal 2 — Agent Worker

```bash
cd backend
venv\Scripts\activate
python -m app.agent dev
```

Wait for:
```
INFO registered worker {"url": "wss://...livekit.cloud"}
LLM: Gemini (gemini-2.0-flash)   # or OpenAI depending on LLM_PROVIDER
```

The agent is now live and joins any LiveKit room where a participant connects.

> To switch LLM providers, just change `LLM_PROVIDER` (and the matching API key) in `.env` and restart the agent worker. No code changes needed.

---

## Local Development (Docker)

```bash
cp .env.example .env    # fill in all keys
docker-compose up --build
```

Starts: REST API on `http://localhost:8000` + agent worker.

---

## Production Deployment

### Step 1 — Database: Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Settings → Database → Connection string → **URI**
3. Copy the `postgresql://...` URI
4. Replace `postgresql://` with `postgresql+asyncpg://`
5. Set as `DATABASE_URL` in all deployment configs below

---

### Step 2 — REST API: Vercel

The FastAPI app deploys as a serverless function on Vercel.

```bash
npm install -g vercel
cd backend
vercel
```

When prompted:
- **Set up and deploy?** → Y
- **Which scope?** → your account
- **Link to existing project?** → N
- **Project name** → `mykare-voice-api`
- **In which directory is your code?** → `./` (current = backend/)
- **Want to override settings?** → N

**Add environment variables in Vercel dashboard:**

Go to `vercel.com` → your project → Settings → Environment Variables and add:

| Variable | Required on Vercel |
|----------|-------------------|
| `LIVEKIT_URL` | Yes |
| `LIVEKIT_API_KEY` | Yes |
| `LIVEKIT_API_SECRET` | Yes |
| `LLM_PROVIDER` | Yes (`openai` or `gemini`) |
| `LLM_MODEL` | Optional |
| `OPENAI_API_KEY` | If `LLM_PROVIDER=openai` |
| `GEMINI_API_KEY` | If `LLM_PROVIDER=gemini` |
| `DATABASE_URL` | Yes (Supabase URL) |
| `DEEPGRAM_API_KEY` | **Not needed** — agent-only |
| `CARTESIA_API_KEY` | **Not needed** — agent-only |

Your API will be live at: `https://mykare-voice-api.vercel.app`

> **Note:** Vercel Hobby plan has a 10s function timeout. Upgrade to Vercel Pro ($20/mo) for the configured 30s timeout (set in `vercel.json`).

---

### Step 3 — Agent Worker: Railway

The agent worker cannot be serverless — it holds a persistent WebSocket to LiveKit Cloud.

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select this repo
3. Set **Root Directory** → `backend`
4. Set **Dockerfile** → `Dockerfile.agent`
5. Add all environment variables (LiveKit keys + LLM keys + Deepgram + Cartesia + DATABASE_URL)
6. Deploy

Railway keeps the container running 24/7. The agent is ready when it logs:
```
INFO registered worker {"url": "wss://...livekit.cloud", "region": "..."}
```

**Alternatives to Railway:** Render, Fly.io, AWS ECS, DigitalOcean App Platform.

---

### Step 4 — Frontend: Lovable

1. Open [lovable.dev](https://lovable.dev)
2. Start a new project → paste the entire contents of `frontend.md`
3. In Lovable project settings → Environment Variables:
   ```
   VITE_API_URL=https://mykare-voice-api.vercel.app
   ```
4. Lovable deploys to its own URL automatically

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/token` | Generate LiveKit room token |
| `GET` | `/appointments/:phone` | List patient appointments |
| `POST` | `/appointments` | Create appointment |
| `DELETE` | `/appointments/:id` | Cancel appointment |
| `POST` | `/summary` | Generate AI call summary |

Full interactive docs (when running locally): `http://localhost:8000/docs`

---

## Agent Tools

| Tool | Action |
|------|--------|
| `identify_user` | Look up / register patient by phone |
| `fetch_slots` | Return available times for a date |
| `book_appointment` | Insert appointment, prevent double-booking |
| `retrieve_appointments` | List patient's appointment history |
| `cancel_appointment` | Mark appointment cancelled |
| `modify_appointment` | Reschedule to new date/time |
| `end_conversation` | Generate AI summary, send to frontend |

---

## Switching LLM Providers

The agent reads `LLM_PROVIDER` from `.env` at startup — no code changes needed.

| Provider | `LLM_PROVIDER` | `LLM_MODEL` default | API key var |
|----------|----------------|---------------------|-------------|
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Gemini | `gemini` | `gemini-2.0-flash` | `GEMINI_API_KEY` |

You can pin any model supported by the provider via `LLM_MODEL`, e.g.:
- `LLM_MODEL=gpt-4o-mini`
- `LLM_MODEL=gemini-1.5-pro`

---

## AWS Lambda Alternative (Serverless Framework)

If you prefer AWS over Vercel:

```bash
cd backend
npm install -g serverless
serverless deploy --region us-east-1
```

Configure env vars in `serverless.yml` or via AWS SSM Parameter Store.
