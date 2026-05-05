# Mykare Health — Frontend Specification for Lovable

## Project Overview

Build a **web-based AI voice agent interface** for Mykare Health clinic. Patients speak to an AI assistant named **Mia** who books, modifies, and cancels healthcare appointments in real time. The frontend connects to a Python backend via REST API and LiveKit WebRTC for voice + real-time events.

**Vibe:** Clean, modern healthcare SaaS. Dark theme preferred. Think Linear meets a medical clinic. Professional but warm.

---

## Tech Stack to Use

- **React + TypeScript**
- **Tailwind CSS**
- **`livekit-client`** npm package for WebRTC voice
- **`axios`** for REST API calls
- No other heavy dependencies needed

---

## Backend URL

The backend REST API is deployed on Vercel. Use that URL as your base URL for all API calls.

**After Vercel deployment**, the backend URL will look like:
```
https://mykare-voice-ai.vercel.app
```

Set this as an environment variable in your Lovable project:

```env
VITE_API_URL=https://mykare-voice-ai.vercel.app
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud   # from cloud.livekit.io
```

> The `livekit_url` is also returned by `POST /token`, so `VITE_LIVEKIT_URL` is optional — the frontend can read it from the API response.

---

## REST API Reference

Base URL: `VITE_API_URL` (e.g. `http://localhost:8000`)

All endpoints return JSON. CORS is open (`*`).

---

### `GET /health`

Health check.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-05-06T10:00:00.000000" }
```

---

### `POST /token`

Generate a LiveKit room access token. Call this before connecting to voice.

**Request body:**
```json
{
  "room_name": "mykare-health",
  "participant_name": "user"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "room_name": "mykare-health",
  "livekit_url": "wss://your-project.livekit.cloud"
}
```

**How to use:**
```typescript
// 1. Call /token to get credentials
// 2. Connect to LiveKit using the returned token + livekit_url
const room = new Room();
await room.connect(livekit_url, token);
await room.localParticipant.setMicrophoneEnabled(true);
```

---

### `GET /appointments/:phone_number`

Fetch all appointments for a patient by phone number.

**Example:** `GET /appointments/9876543210`

**Response:**
```json
[
  {
    "id": 1,
    "date": "2026-05-10",
    "time": "10:00",
    "status": "confirmed",
    "notes": "General checkup",
    "created_at": "2026-05-06T10:00:00"
  },
  {
    "id": 2,
    "date": "2026-05-15",
    "time": "14:30",
    "status": "cancelled",
    "notes": null,
    "created_at": "2026-05-06T11:00:00"
  }
]
```

**Status values:** `"confirmed"` | `"cancelled"`

---

### `POST /appointments`

Manually create an appointment (outside of voice — for an admin panel or testing).

**Request body:**
```json
{
  "user_id": "9876543210",
  "name": "Priya Sharma",
  "phone_number": "9876543210",
  "date": "2026-05-10",
  "time": "10:00",
  "notes": "Routine checkup"
}
```

**Success (201):**
```json
{ "id": 3, "message": "Appointment created" }
```

**Conflict (409):**
```json
{ "detail": "Time slot already booked" }
```

---

### `DELETE /appointments/:appointment_id`

Cancel an appointment by ID.

**Example:** `DELETE /appointments/1`

**Response:**
```json
{ "message": "Cancelled" }
```

**Not found (404):**
```json
{ "detail": "Not found" }
```

---

### `POST /summary`

Generate an AI call summary from a transcript + appointment list.
Call this if you want to generate a summary outside of the voice agent.

**Request body:**
```json
{
  "transcript": [
    { "role": "user", "content": "I want to book an appointment" },
    { "role": "assistant", "content": "Sure! May I get your phone number?" }
  ],
  "appointments": [
    { "appointment_id": 1, "date": "2026-05-10", "time": "10:00", "name": "Priya" }
  ]
}
```

**Response:**
```json
{
  "summary": "Patient Priya Sharma called to book a new appointment. Successfully booked for May 10th at 10:00 AM.",
  "user_name": "Priya Sharma",
  "phone_number": "9876543210",
  "intent": "booking",
  "appointments": [...],
  "user_preferences": ["morning slots"],
  "follow_up_needed": false,
  "sentiment": "positive",
  "call_duration_estimate": "3 minutes"
}
```

**`intent` values:** `"booking"` | `"cancellation"` | `"modification"` | `"inquiry"` | `"mixed"` | `"unknown"`

**`sentiment` values:** `"positive"` | `"neutral"` | `"negative"`

---

## LiveKit Real-Time Events (Data Channel)

This is the most important part. During a voice call, the AI agent sends **JSON messages over LiveKit's data channel** to update the UI in real time. No polling needed.

### How to Subscribe

```typescript
import { Room, RoomEvent } from 'livekit-client';

room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
  const message = JSON.parse(new TextDecoder().decode(payload));
  // message.type tells you what happened
  handleMessage(message);
});
```

---

### Event: `transcript`

Fired every time the user or AI speaks a complete sentence.

```json
{
  "type": "transcript",
  "role": "user",
  "content": "I want to book an appointment for tomorrow",
  "timestamp": "2026-05-06T10:23:01.123456"
}
```

```json
{
  "type": "transcript",
  "role": "assistant",
  "content": "Of course! May I start by getting your phone number?",
  "timestamp": "2026-05-06T10:23:03.456789"
}
```

**`role` values:** `"user"` | `"assistant"`

**UI action:** Append to conversation transcript. Show user messages right-aligned (blue), assistant messages left-aligned (teal/white).

---

### Event: `tool_event`

Fired when the AI calls a backend tool. Each tool call sends two events: one when it starts (`"calling"`) and one when it finishes (`"success"` or `"error"`).

```json
{
  "type": "tool_event",
  "tool": "identify_user",
  "status": "calling",
  "data": { "phone_number": "9876543210" },
  "timestamp": "2026-05-06T10:23:05.000000"
}
```

```json
{
  "type": "tool_event",
  "tool": "identify_user",
  "status": "success",
  "data": { "found": true, "user_id": "9876543210", "name": "Priya Sharma" },
  "timestamp": "2026-05-06T10:23:05.230000"
}
```

**`tool` values and what they mean:**

| tool | what happened |
|------|--------------|
| `identify_user` | AI looked up patient by phone number |
| `fetch_slots` | AI checked available appointment times |
| `book_appointment` | AI booked an appointment |
| `retrieve_appointments` | AI fetched patient's appointment history |
| `cancel_appointment` | AI cancelled an appointment |
| `modify_appointment` | AI rescheduled an appointment |
| `end_conversation` | Call is ending, summary is being generated |

**`status` values:** `"calling"` | `"success"` | `"error"`

**UI action:** Show a live activity feed. While `status === "calling"`, show a spinner. On `"success"`, show a green checkmark + relevant data. On `"error"`, show red with the error message from `data.error`.

**Example `data` payloads by tool:**

`fetch_slots` success:
```json
{ "date": "2026-05-10", "available_slots": ["09:00", "10:00", "14:30", "16:00"] }
```

`book_appointment` success:
```json
{ "success": true, "appointment_id": 3, "date": "2026-05-10", "time": "10:00", "name": "Priya Sharma" }
```

`book_appointment` error:
```json
{ "success": false, "error": "Slot already booked. Please choose another time." }
```

`retrieve_appointments` success:
```json
{
  "appointments": [
    { "id": 1, "date": "2026-05-10", "time": "10:00", "status": "confirmed", "notes": null }
  ]
}
```

---

### Event: `call_summary`

Fired once when the AI calls `end_conversation`. Contains the full GPT-4o generated summary.

```json
{
  "type": "call_summary",
  "summary": {
    "summary": "Patient Priya Sharma called to book a new appointment...",
    "user_name": "Priya Sharma",
    "phone_number": "9876543210",
    "intent": "booking",
    "appointments": [
      { "id": 3, "date": "2026-05-10", "time": "10:00", "status": "confirmed" }
    ],
    "user_preferences": ["morning slots", "prefers weekdays"],
    "follow_up_needed": false,
    "sentiment": "positive",
    "call_duration_estimate": "4 minutes"
  },
  "timestamp": "2026-05-06T10:30:00.000000"
}
```

**UI action:** Show a full-screen modal or side panel with the formatted summary. This is shown at the end of every call.

---

## Agent Audio (for Avatar Animation)

To animate an avatar's mouth in sync with the AI speaking:

```typescript
import { Track, RoomEvent } from 'livekit-client';

room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === Track.Kind.Audio) {
    // Attach audio to play in browser
    track.attach();

    // Analyse audio level for mouth animation
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const source = audioCtx.createMediaStreamSource(
      new MediaStream([track.mediaStreamTrack])
    );
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const animate = () => {
      analyser.getByteFrequencyData(data);
      const volume = data.slice(0, 32).reduce((a, b) => a + b, 0) / 32 / 80;
      // volume is 0–1. Use it to open/close avatar mouth.
      requestAnimationFrame(animate);
    };
    animate();
  }
});
```

---

## Complete Connection Flow

```
1. User clicks "Start Call"
2. POST /token → { token, livekit_url }
3. room.connect(livekit_url, token)
4. room.localParticipant.setMicrophoneEnabled(true)
5. Agent joins room automatically (LiveKit dispatches it)
6. Agent sends audio → play via track.attach()
7. Agent sends data messages → update UI in real time
8. User speaks → Deepgram transcribes → GPT-4o responds → Cartesia voices it
9. User says goodbye → agent calls end_conversation
10. call_summary event fires → show summary modal
11. User clicks "End Call" → room.disconnect()
```

---

## Agent States to Track in UI

Derive these from the events you receive:

| State | How to detect | UI treatment |
|-------|--------------|-------------|
| `idle` | Before call starts | "Start Call" button |
| `connecting` | After POST /token, before room connects | Spinner |
| `connected` | `RoomEvent.Connected` fires | Show avatar, "End Call" button |
| `listening` | `transcript` event with `role: "user"` | Blue pulse ring on avatar |
| `thinking` | `tool_event` with `status: "calling"` | Purple/amber indicator |
| `speaking` | `transcript` event with `role: "assistant"` | Mouth animation active, teal ring |
| `ended` | `call_summary` event fires OR user clicks End | Show summary button |

---

## UI Screens / Components to Build

### 1. Main Call Screen (3-column layout)

```
┌─────────────────────────────────────────────────────┐
│  🏥 Mykare Health                      [● Live]     │
├──────────────────┬──────────────┬───────────────────┤
│                  │              │                   │
│  TRANSCRIPT      │  AI AVATAR   │  LIVE ACTIVITY    │
│                  │  (animated   │                   │
│  AI: Hello!      │   face)      │  👤 Identifying   │
│                  │              │     patient... ⏳  │
│  You: Book...    │  [Mia]       │                   │
│                  │  Connected   │  ✓ Slots fetched  │
│  AI: Sure...     │              │  ✓ Booked #3      │
│                  │  [🎤 End]   │                   │
└──────────────────┴──────────────┴───────────────────┘
```

### 2. Pre-call Landing Screen

Full-page centered layout. Show:
- Clinic logo / name
- "Talk to Mia" heading
- Subtitle: "AI-powered appointment assistant"
- Big "Start Call" button with microphone icon
- Note: "Mic permission will be requested"

### 3. Call Summary Modal

Appears when `call_summary` event fires. Show:
- Summary text (paragraph)
- Patient name + phone
- Intent badge (color-coded: green=booking, red=cancel, amber=modify)
- Sentiment badge
- Appointments list with date/time/status chips
- Preferences tags (if any)
- Follow-up warning (if `follow_up_needed === true`)
- "Close" button + "New Call" button

### 4. Activity Feed (right panel)

Live scrolling list of tool events. Each item:
- Tool icon (👤 📅 ✅ 📋 ❌ ✏️ 📝)
- Tool label ("Booking appointment...")
- Status indicator: amber spinner / green ✓ / red ✗
- Key data snippet (e.g. "May 10 at 10:00")
- Timestamp

---

## AI Avatar Suggestions

Build a canvas-based animated face OR use a Lottie animation. The avatar should:

- **Idle state:** Gentle blinking every 3–5 seconds, soft breathing
- **Speaking state:** Mouth opens/closes based on `volume` (0–1 from audio analyser)
- **Listening state:** Animated sound wave rings, slight head tilt indicator
- **Thinking state:** 3-dot bounce animation, subtle glow
- **Color accent:** Changes with state — teal (speaking), blue (listening), amber (thinking), slate (idle)

---

## Available Time Slots (hardcoded in backend)

The agent only books within these slots:
```
Morning:   09:00  09:30  10:00  10:30  11:00  11:30
Afternoon: 14:00  14:30  15:00  15:30  16:00  16:30  17:00
```

You can display these visually in a slot picker component if you want a manual booking flow alongside voice.

---

## Error States to Handle

| Scenario | How to detect | What to show |
|----------|--------------|-------------|
| Mic permission denied | `getUserMedia` throws | "Microphone access required" toast |
| Backend unreachable | `/token` fetch fails | "Server unavailable, try again" |
| LiveKit connection drop | `RoomEvent.Disconnected` | "Connection lost" banner + reconnect button |
| Agent not responding | No transcript/audio for 30s | "Agent seems quiet..." with manual end option |
| Slot conflict | `tool_event` error for `book_appointment` | Flash the activity feed item red |

---

## Design Tokens / Color Guide

```
Background:     #020617  (slate-950)
Card:           #0f172a  (slate-900)
Border:         #1e293b  (slate-800)
Text primary:   #f1f5f9  (slate-100)
Text muted:     #64748b  (slate-500)

Accent teal:    #14b8a6  (speaking / confirmed)
Accent blue:    #3b82f6  (listening / user messages)
Accent amber:   #f59e0b  (thinking / in-progress)
Accent purple:  #a855f7  (AI messages / AI activity)
Accent red:     #ef4444  (error / cancelled)
```

---

## npm Package to Install

```bash
npm install livekit-client axios
```

That's all you need alongside React + Tailwind.

---

## Quick Integration Checklist

- [ ] `POST /token` called on "Start Call" click
- [ ] LiveKit room connected with returned `livekit_url` + `token`  
- [ ] Microphone enabled via `localParticipant.setMicrophoneEnabled(true)`
- [ ] `RoomEvent.DataReceived` handler decodes UTF-8 JSON and routes by `message.type`
- [ ] `RoomEvent.TrackSubscribed` attaches agent audio + hooks analyser for avatar
- [ ] Transcript appended on every `transcript` event
- [ ] Activity feed updated on every `tool_event`
- [ ] Summary modal shown on `call_summary` event
- [ ] `room.disconnect()` called when user ends call or call_summary received
