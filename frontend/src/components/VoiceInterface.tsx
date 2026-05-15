import { useEffect, useRef, useState } from "react";
import { useVoiceAgent } from "../hooks/useVoiceAgent";
import Avatar from "./Avatar";
import TranscriptPanel from "./TranscriptPanel";
import ToolStatus from "./ToolStatus";
import CallSummaryModal from "./CallSummary";
import CalendarView from "./CalendarView";
import { getCategories } from "../lib/api";
import type { Category } from "../lib/api";

// ── Icons ─────────────────────────────────────────────────────────────────────
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" x2="22" y1="2" y2="22"/>
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
      <path d="M5 10v2a7 7 0 0 0 12 5"/>
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/>
      <path d="M14.5 4A10 10 0 0 1 20 9.5"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
      <path d="M4.68 4.68C3.06 6.32 2 8.55 2 11a15.94 15.94 0 0 0 3.07 8.63 2 2 0 0 0 2.18.45 12.84 12.84 0 0 0 2.81-.7 2 2 0 0 1 2.11.45l1.27 1.27"/>
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

// ── Typewriter greeting ───────────────────────────────────────────────────────
function TypewriterText({ text, speed = 55, startDelay = 0 }: {
  text: string; speed?: number; startDelay?: number;
}) {
  const [shown, setShown] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [started, text, speed]);

  return (
    <>
      {shown}
      {shown.length < text.length && (
        <span className="inline-block w-0.5 h-[0.9em] bg-teal-400 align-middle ml-0.5 animate-pulse" />
      )}
    </>
  );
}

// ── Soundwave ─────────────────────────────────────────────────────────────────
function SoundwaveIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0.6, 1, 1.4, 1, 1.6, 1.2, 0.8].map((h, i) => (
        <div key={i} className="soundwave-bar w-1 bg-blue-400 rounded-full"
          style={{ height: `${h * 7}px`, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

// ── State badges ──────────────────────────────────────────────────────────────
const STATE_DOT: Record<string, string> = {
  connected: "bg-teal-400", speaking: "bg-teal-400",
  listening: "bg-blue-400", thinking: "bg-amber-400",
  connecting: "bg-amber-400", ended: "bg-slate-500",
};
const STATE_LABEL: Record<string, string> = {
  connecting: "Connecting…", connected: "Connected",
  speaking: "Mia is speaking", listening: "Listening",
  thinking: "Thinking…", ended: "Call ended",
};

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Category grid card ────────────────────────────────────────────────────────
function CategoryCard({ cat }: { cat: Category }) {
  return (
    <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/60
                    rounded-xl px-3 py-2.5 hover:bg-slate-800 hover:border-slate-600/80
                    transition-colors cursor-default">
      <span className="text-lg flex-shrink-0 leading-none">{cat.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
          {cat.display_name}
        </p>
        <p className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight">
          {cat.description}
        </p>
      </div>
    </div>
  );
}

// ── LANDING SCREEN ────────────────────────────────────────────────────────────
function LandingScreen({ onStart, error }: { onStart: () => void; error: string | null }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then(c => { setCategories(c); setCatsLoading(false); })
      .catch(() => setCatsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden">

      {/* ── Navbar ── */}
      <header className="px-6 py-4 flex items-center gap-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600
                        flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
          <HeartIcon />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">Mykare Health</p>
          <p className="text-xs text-slate-500 mt-0.5">AI Voice Assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-teal-400
                        bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          Available 24/7
        </div>
      </header>

      {/* ── Two-panel hero ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_440px] min-h-0">

        {/* ── Left: greeting + departments + CTA ── */}
        <div className="relative flex flex-col justify-start overflow-y-auto
                        px-8 py-8 lg:px-12">
          {/* Ambient orbs */}
          <div className="orb-pulse absolute w-[500px] h-[500px] rounded-full bg-teal-500
                          blur-[120px] opacity-[0.06] top-1/2 -translate-y-1/2 -left-48
                          pointer-events-none" />
          <div className="orb-pulse-slow absolute w-64 h-64 rounded-full bg-blue-600
                          blur-[80px] opacity-[0.05] bottom-8 right-8 pointer-events-none" />

          <div className="relative z-10 max-w-xl">

            {/* Brand chip */}
            <div className="fade-up inline-flex items-center gap-2 text-xs font-bold
                            tracking-[0.18em] uppercase text-teal-400 bg-teal-500/10
                            border border-teal-500/20 px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              Mykare Health AI
            </div>

            {/* Greeting */}
            <h1 className="fade-up-d1 font-display text-5xl xl:text-6xl font-bold text-white
                           leading-[1.05] mb-3">
              Hello!&nbsp;I'm{" "}
              <span className="text-teal-400">
                <TypewriterText text="Mia." startDelay={700} />
              </span>
            </h1>
            <p className="fade-up-d2 text-slate-400 text-base leading-relaxed mb-6 max-w-md">
              Your AI front-desk assistant — tell me your health concern, share your
              email and phone number, and I'll book the right specialist for you.
            </p>

            {/* How it works — quick steps */}
            <div className="fade-up-d2 flex items-start gap-6 mb-7 text-xs text-slate-500">
              {[
                ["1", "Share email & phone"],
                ["2", "Describe your concern"],
                ["3", "Pick an available slot"],
                ["4", "Appointment confirmed"],
              ].map(([n, label]) => (
                <div key={n} className="flex flex-col items-center gap-1.5 text-center min-w-[64px]">
                  <span className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/30
                                   text-teal-400 font-bold text-[10px] flex items-center justify-center">
                    {n}
                  </span>
                  <span className="leading-tight">{label}</span>
                </div>
              ))}
            </div>

            {/* Departments grid */}
            <div className="fade-up-d3 mb-7">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">
                Our 10 Departments
              </p>
              {catsLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <CategoryCard key={cat.id} cat={cat} />
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="fade-up-d4 flex flex-col items-start gap-2">
              <div className="relative inline-flex">
                <span className="ring-ping absolute inset-0 rounded-2xl border-2 border-teal-400/40" />
                <button
                  onClick={onStart}
                  className="relative inline-flex items-center gap-3 bg-teal-500 hover:bg-teal-400
                             text-white font-semibold text-lg px-8 py-4 rounded-2xl
                             transition-all duration-200 active:scale-95
                             shadow-xl shadow-teal-500/25 hover:shadow-teal-500/40"
                >
                  <span className="w-10 h-10 rounded-full bg-white/15 flex items-center
                                   justify-center flex-shrink-0">
                    <MicIcon />
                  </span>
                  Start Voice Call
                </button>
              </div>
              <p className="text-xs text-slate-600">Microphone access required</p>
            </div>

            {error && (
              <div className="mt-5 text-sm text-red-400 bg-red-400/10
                              border border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: live calendar ── */}
        <div className="lg:border-l border-slate-800/70 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 pt-3 pb-1.5 flex-shrink-0 border-b border-slate-800/60">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              Live Availability
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Filter by department · click a date to see open slots
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            <CalendarView />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── IN-CALL / ENDED SCREEN ────────────────────────────────────────────────────
export default function VoiceInterface() {
  const {
    agentState, transcript, toolEvents, callSummary,
    isMicMuted, mouthOpenness, startCall, endCall, toggleMic,
  } = useVoiceAgent();

  const [showSummary, setShowSummary] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => { if (callSummary) setShowSummary(true); }, [callSummary]);

  useEffect(() => {
    const active = agentState !== "idle" && agentState !== "ended" && agentState !== "connecting";
    if (active) {
      timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (agentState === "idle") setCallSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [agentState]);

  async function handleStart() {
    setError(null);
    setCallSeconds(0);
    try { await startCall(); }
    catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call. Check your connection.");
    }
  }

  const isActive = agentState !== "idle" && agentState !== "ended";
  const hasEnded = agentState === "ended";

  // ── Landing ──
  if (agentState === "idle") {
    return <LandingScreen onStart={handleStart} error={error} />;
  }

  // ── In-call / ended ──
  return (
    <div className="h-screen flex flex-col bg-slate-950">

      {/* Sticky header */}
      <header className="border-b border-slate-800/80 px-5 py-3 flex items-center
                         justify-between flex-shrink-0 bg-slate-950/80 backdrop-blur-sm
                         sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600
                          flex items-center justify-center text-white flex-shrink-0">
            <HeartIcon />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-none">Mykare Health</p>
            <p className="text-xs text-slate-500 mt-0.5">AI Voice Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isActive && callSeconds > 0 && (
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {fmt(callSeconds)}
            </span>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            isActive
              ? "text-teal-400 bg-teal-400/10 border-teal-400/20"
              : "text-slate-400 bg-slate-800 border-slate-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full
              ${STATE_DOT[agentState] || "bg-slate-500"} ${isActive ? "animate-pulse" : ""}`} />
            {STATE_LABEL[agentState] || agentState}
          </div>
        </div>
      </header>

      {/* ── 3-column layout ── */}
      {/*  Transcript  |  Avatar + Calendar  |  Live Activity  */}
      <main
        className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px_260px] gap-3 p-3
                   min-h-0 overflow-hidden"
        style={{ height: "calc(100vh - 61px)" }}
      >
        {/* Transcript */}
        <TranscriptPanel messages={transcript} />

        {/* Center: Avatar card + compact calendar */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Avatar card */}
          <div className="card flex-shrink-0 py-5 px-4 flex flex-col items-center">
            <Avatar state={agentState} mouthOpenness={mouthOpenness} />
            <div className="mt-3 text-center">
              <p className="font-display font-bold text-white text-base leading-none">Mia</p>
              <p className="text-[11px] text-slate-500 mt-0.5">AI Healthcare Assistant</p>
            </div>
            <div className="h-5 mt-2 flex items-center">
              <SoundwaveIndicator active={agentState === "listening"} />
            </div>

            {/* Inline call controls */}
            <div className="mt-3 w-full flex flex-col gap-2">
              {agentState === "connecting" && (
                <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-amber-400">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Connecting to Mia…
                </div>
              )}

              {isActive && agentState !== "connecting" && (
                <>
                  <button
                    onClick={toggleMic}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                                font-medium text-sm transition-all ${
                      isMicMuted
                        ? "bg-slate-700 text-slate-300 border border-slate-600"
                        : "bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/25"
                    }`}
                  >
                    {isMicMuted
                      ? <><MicOffIcon /><span>Unmute</span></>
                      : <><MicIcon /><span>Mute</span></>}
                  </button>
                  <button onClick={endCall}
                    className="btn-danger flex items-center justify-center gap-2">
                    <PhoneOffIcon /> End Call
                  </button>
                </>
              )}

              {hasEnded && !callSummary && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Generating summary…
                </div>
              )}

              {hasEnded && callSummary && (
                <>
                  <button onClick={() => setShowSummary(true)}
                    className="btn-primary flex items-center justify-center gap-2">
                    <ClipboardIcon /> View Summary
                  </button>
                  <button onClick={() => window.location.reload()}
                    className="btn-ghost flex items-center justify-center gap-2">
                    ↺ New Call
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Compact calendar — fills remaining space, auto-tracks patient via toolEvents */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CalendarView compact toolEvents={toolEvents} />
          </div>
        </div>

        {/* Live activity panel */}
        <ToolStatus events={toolEvents} />
      </main>

      {showSummary && callSummary && (
        <CallSummaryModal summary={callSummary} onClose={() => setShowSummary(false)} />
      )}
    </div>
  );
}
