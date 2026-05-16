import { useEffect, useState } from "react";
import { getCallSessions, type CallSessionRecord, type CallSummary } from "../lib/api";
import CallSummaryModal from "./CallSummary";

const INTENT_LABEL: Record<string, string> = {
  booking: "Booking", cancellation: "Cancellation",
  modification: "Rescheduling", inquiry: "Inquiry",
  mixed: "Mixed", unknown: "General",
};

const INTENT_COLOR: Record<string, string> = {
  booking: "text-teal-300 bg-teal-500/15 border-teal-500/25",
  cancellation: "text-red-300 bg-red-500/15 border-red-500/25",
  modification: "text-amber-300 bg-amber-500/15 border-amber-500/25",
  inquiry: "text-blue-300 bg-blue-500/15 border-blue-500/25",
  mixed: "text-purple-300 bg-purple-500/15 border-purple-500/25",
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "text-teal-400",
  neutral: "text-slate-400",
  negative: "text-red-400",
};

const SENTIMENT_ICON: Record<string, string> = {
  positive: "↑", neutral: "–", negative: "↓",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  onClose: () => void;
}

export default function CallHistory({ onClose }: Props) {
  const [sessions, setSessions] = useState<CallSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<CallSummary | null>(null);

  useEffect(() => {
    getCallSessions(50)
      .then(s => { setSessions(s); setLoading(false); })
      .catch(() => { setError("Failed to load call history."); setLoading(false); });
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="slide-in bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl
                        max-h-[90vh] flex flex-col shadow-2xl">

          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Call History</h2>
              <p className="text-xs text-slate-500 mt-1">All sessions handled by Mia</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400
                         hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Loading sessions…
              </div>
            )}

            {error && (
              <div className="text-center py-16 text-red-400 text-sm">{error}</div>
            )}

            {!loading && !error && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="#475569" strokeWidth="1.5">
                    <rect width="8" height="4" x="8" y="2" rx="1"/>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">No call sessions yet.</p>
                <p className="text-slate-600 text-xs mt-1">Sessions will appear here after calls end.</p>
              </div>
            )}

            {!loading && !error && sessions.length > 0 && (
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id}
                    className="flex items-start gap-4 bg-slate-800/40 border border-slate-800
                               hover:border-slate-700 rounded-xl px-4 py-3.5 transition-colors">

                    {/* Left: date + room */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Patient */}
                        <span className="text-sm font-semibold text-white truncate">
                          {s.user_name || "Unknown patient"}
                        </span>
                        {s.phone_number && (
                          <span className="text-xs text-slate-500">{s.phone_number}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {/* Intent badge */}
                        <span className={`badge border text-[10px] px-2 py-0.5 rounded-full
                          ${INTENT_COLOR[s.intent] || "text-slate-300 bg-slate-800 border-slate-700"}`}>
                          {INTENT_LABEL[s.intent] || s.intent}
                        </span>

                        {/* Sentiment */}
                        <span className={`text-xs font-medium ${SENTIMENT_COLOR[s.sentiment] || "text-slate-400"}`}>
                          {SENTIMENT_ICON[s.sentiment]} {s.sentiment}
                        </span>

                        {/* Cost */}
                        {s.cost_usd !== null && s.cost_usd !== undefined && (
                          <span className="text-xs text-teal-400 font-mono">
                            ${s.cost_usd < 0.001
                              ? s.cost_usd.toFixed(6)
                              : s.cost_usd.toFixed(4)}
                          </span>
                        )}

                        {/* Tokens */}
                        {s.tokens_total !== null && s.tokens_total !== undefined && (
                          <span className="text-xs text-slate-600 font-mono">
                            {s.tokens_total.toLocaleString()} tok
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 mt-1">{formatDate(s.created_at)}</p>

                      {/* Summary snippet */}
                      {s.summary_text && (
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {s.summary_text}
                        </p>
                      )}
                    </div>

                    {/* Right: view summary button */}
                    {s.summary_json && (
                      <button
                        onClick={() => setActiveSummary(s.summary_json)}
                        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium
                                   text-teal-400 bg-teal-400/10 border border-teal-400/20
                                   hover:bg-teal-400/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5">
                          <rect width="8" height="4" x="8" y="2" rx="1"/>
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        </svg>
                        Summary
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 pb-5 pt-2 flex-shrink-0">
            <button onClick={onClose} className="btn-ghost w-full">Close</button>
          </div>
        </div>
      </div>

      {activeSummary && (
        <CallSummaryModal
          summary={activeSummary}
          onClose={() => setActiveSummary(null)}
        />
      )}
    </>
  );
}
