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
│   │   ├── summary.py      ← GPT-4o call summary generator
│   │   └── config.py       ← Pydantic settings from .env
│   ├── api/
│   │   └── index.py        ← Vercel serverless entry point
│   ├── Dockerfile           ← FastAPI API container (local/Docker)
│   ├── Dockerfile.agent     ← LiveKit agent worker container
│   ├── vercel.json          ← Vercel deployment config
│   └── serverless.yml       ← AWS Lambda alternative
├── .env.example             ← All required environment variables
├── docker-compose.yml       ← Local dev (API + agent together)
├── frontend.md              ← Full frontend spec for Lovable
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
│  GET  /appts     │           │  GPT-4o    → LLM         │
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
> Both share the same Supabase database.

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Where to get it |
|----------|----------------|
| `LIVEKIT_URL` | [cloud.livekit.io](https://cloud.livekit.io) → Project → Settings → Keys |
| `LIVEKIT_API_KEY` | same page |
| `LIVEKIT_API_SECRET` | same page |
| `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) → API Keys |
| `CARTESIA_API_KEY` | [play.cartesia.ai](https://play.cartesia.ai) → Account → API Keys |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `DATABASE_URL` | Supabase: `postgresql+asyncpg://postgres:[pwd]@db.[ref].supabase.co:5432/postgres` |

---

## Local Development (no Docker)

### Terminal 1 — REST API

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # fill in your keys
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

### Terminal 2 — Agent Worker

```bash
cd backend
venv\Scripts\activate
python -m app.agent dev
```

Wait for: `INFO registered worker {"url": "wss://...livekit.cloud"}`
The agent is now live and will join any room where a participant connects.

---

## Local Development (Docker)

```bash
cp .env.example .env    # fill in all keys
docker-compose up --build
```

Starts: API on `http://localhost:8000` + agent worker.

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
# Install Vercel CLI
npm install -g vercel

# Deploy from the backend directory
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

Go to `vercel.com` → your project → Settings → Environment Variables.
Add every variable from `.env.example` (use your real Supabase `DATABASE_URL`).

Your API will be live at: `https://mykare-voice-api.vercel.app`

> **Note:** Vercel Hobby plan has 10s function timeout. The `/summary` endpoint calls GPT-4o and may need ~5s. Upgrade to Vercel Pro ($20/mo) for 30s timeout, or use the Serverless Framework (AWS Lambda) alternative below.

---

### Step 3 — Agent Worker: Railway

The agent worker CANNOT be serverless — it holds a persistent WebSocket to LiveKit Cloud. Deploy it to Railway (free tier available).

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select this repo
3. Set **Root Directory** → `backend`
4. Set **Dockerfile** → `Dockerfile.agent`
5. Add all environment variables (same as Vercel, same keys)
6. Deploy

Railway will keep the container running 24/7. The agent is ready as soon as it logs:
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

The frontend connects to your Vercel backend for tokens and appointment data, and to LiveKit Cloud directly for voice.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/token` | Generate LiveKit room token |
| `GET` | `/appointments/:phone` | List patient appointments |
| `POST` | `/appointments` | Create appointment |
| `DELETE` | `/appointments/:id` | Cancel appointment |
| `POST` | `/summary` | Generate GPT-4o call summary |

Full API docs (when running locally): `http://localhost:8000/docs`

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
| `end_conversation` | Generate GPT-4o summary, send to frontend |

---

## AWS Lambda Alternative (Serverless Framework)

If you prefer AWS over Vercel:

```bash
cd backend
npm install -g serverless
serverless deploy --region us-east-1
```

Configure env vars in `serverless.yml` or via AWS SSM Parameter Store.
