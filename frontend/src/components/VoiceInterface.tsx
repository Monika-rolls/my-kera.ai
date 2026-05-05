import { useState } from "react";
import { useVoiceAgent } from "../hooks/useVoiceAgent";
import Avatar from "./Avatar";
import TranscriptPanel from "./TranscriptPanel";
import ToolStatus from "./ToolStatus";
import CallSummaryModal from "./CallSummary";

function SoundwaveIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[1, 1.5, 1, 2, 1.5, 1, 0.8].map((h, i) => (
        <div
          key={i}
          className="soundwave-bar w-1 bg-blue-400 rounded-full"
          style={{
            height: `${h * 8}px`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.6 + i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function VoiceInterface() {
  const {
    agentState,
    transcript,
    toolEvents,
    callSummary,
    isMicMuted,
    mouthOpenness,
    startCall,
    endCall,
    toggleMic,
  } = useVoiceAgent();

  const [showSummary, setShowSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = agentState !== "idle" && agentState !== "ended";
  const hasEnded = agentState === "ended";

  async function handleStart() {
    setError(null);
    try {
      await startCall();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call. Check your API keys.");
    }
  }

  // Show summary modal when call ends and summary is ready
  const shouldShowSummaryButton = hasEnded && callSummary;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-sm">❤️</div>
          <div>
            <h1 className="font-bold text-white text-sm">Mykare Health</h1>
            <p className="text-xs text-slate-500">AI Voice Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <div className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-400/10 px-3 py-1.5 rounded-full border border-teal-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Live
            </div>
          )}
          {hasEnded && (
            <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
              Call ended
            </div>
          )}
        </div>
      </header>

      {/* Main 3-panel layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px_280px] gap-4 p-4 min-h-0" style={{ height: "calc(100vh - 69px)" }}>
        {/* Left: Transcript */}
        <TranscriptPanel messages={transcript} />

        {/* Center: Avatar + controls */}
        <div className="flex flex-col gap-4">
          {/* Avatar card */}
          <div className="card flex flex-col items-center justify-center py-8 px-4 flex-shrink-0">
            <Avatar state={agentState} mouthOpenness={mouthOpenness} />

            {/* Agent name */}
            <div className="mt-4 text-center">
              <p className="font-semibold text-white">Mia</p>
              <p className="text-xs text-slate-500 mt-0.5">AI Healthcare Assistant</p>
            </div>

            {/* Listening indicator */}
            <div className="h-6 mt-3 flex items-center">
              {agentState === "listening" && (
                <SoundwaveIndicator active />
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="card p-4 flex flex-col gap-3 flex-shrink-0">
            {!isActive && !hasEnded && (
              <button onClick={handleStart} className="btn-primary flex items-center justify-center gap-2">
                <span>🎤</span> Start Call
              </button>
            )}

            {isActive && (
              <>
                <button
                  onClick={toggleMic}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
                    isMicMuted
                      ? "bg-slate-700 text-slate-300 border border-slate-600"
                      : "bg-blue-600/20 text-blue-300 border border-blue-600/30 hover:bg-blue-600/30"
                  }`}
                >
                  {isMicMuted ? "🎤 Unmute" : "🔇 Mute"}
                </button>
                <button onClick={endCall} className="btn-danger flex items-center justify-center gap-2">
                  <span>📵</span> End Call
                </button>
              </>
            )}

            {hasEnded && !shouldShowSummaryButton && (
              <div className="text-center text-sm text-slate-400 py-2">
                Generating summary...
              </div>
            )}

            {shouldShowSummaryButton && (
              <>
                <button
                  onClick={() => setShowSummary(true)}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <span>📋</span> View Summary
                </button>
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all"
                >
                  <span>🔄</span> New Call
                </button>
              </>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Session stats */}
          {(isActive || hasEnded) && (
            <div className="card px-4 py-3 flex items-center justify-between text-xs text-slate-500">
              <span>Messages: {transcript.length}</span>
              <span>·</span>
              <span>Actions: {toolEvents.filter(e => e.status === "success").length}</span>
              <span>·</span>
              <span className={hasEnded ? "text-slate-400" : "text-teal-400"}>
                {hasEnded ? "Ended" : "Active"}
              </span>
            </div>
          )}
        </div>

        {/* Right: Tool activity */}
        <ToolStatus events={toolEvents} />
      </main>

      {/* Call summary modal */}
      {showSummary && callSummary && (
        <CallSummaryModal summary={callSummary} onClose={() => setShowSummary(false)} />
      )}
    </div>
  );
}
