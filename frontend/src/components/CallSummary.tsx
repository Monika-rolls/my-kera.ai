import type { CallSummary } from "../lib/api";

interface Props {
  summary: CallSummary;
  onClose: () => void;
}

const SENTIMENT_STYLE = {
  positive: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  neutral:  "text-slate-400 bg-slate-400/10 border-slate-400/20",
  negative: "text-red-400 bg-red-400/10 border-red-400/20",
};

const INTENT_STYLE: Record<string, string> = {
  booking:      "text-teal-300 bg-teal-500/15 border-teal-500/25",
  cancellation: "text-red-300 bg-red-500/15 border-red-500/25",
  modification: "text-amber-300 bg-amber-500/15 border-amber-500/25",
  inquiry:      "text-blue-300 bg-blue-500/15 border-blue-500/25",
  mixed:        "text-purple-300 bg-purple-500/15 border-purple-500/25",
};

const INTENT_LABEL: Record<string, string> = {
  booking: "New Booking", cancellation: "Cancellation",
  modification: "Rescheduling", inquiry: "General Inquiry",
  mixed: "Mixed", unknown: "General",
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
  pending:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function CallSummaryModal({ summary, onClose }: Props) {
  const intentStyle = INTENT_STYLE[summary.intent] || "text-slate-300 bg-slate-800 border-slate-700";
  const sentimentStyle = SENTIMENT_STYLE[summary.sentiment] || SENTIMENT_STYLE.neutral;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="slide-in bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Call Summary</h2>
            <p className="text-xs text-slate-500 mt-1">Generated at end of conversation</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sheets saved badge */}
            {summary.sheets_saved === true && (
              <span className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-400/10 border border-teal-400/20 px-3 py-1.5 rounded-full">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Saved to Sheets
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Summary text */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-slate-200 leading-relaxed text-sm">{summary.summary}</p>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {summary.user_name && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Patient</p>
                <p className="text-sm font-semibold text-white truncate">{summary.user_name}</p>
              </div>
            )}
            {summary.phone_number && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Phone</p>
                <p className="text-sm font-semibold text-white">{summary.phone_number}</p>
              </div>
            )}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1.5">Intent</p>
              <span className={`badge border ${intentStyle}`}>
                {INTENT_LABEL[summary.intent] || summary.intent}
              </span>
            </div>
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1.5">Sentiment</p>
              <span className={`badge border capitalize ${sentimentStyle}`}>
                {summary.sentiment}
              </span>
            </div>
          </div>

          {/* Appointments */}
          {summary.appointments && summary.appointments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Appointments
              </h3>
              <div className="space-y-2">
                {summary.appointments.map((appt, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-800/40 border border-slate-800 rounded-xl px-4 py-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      appt.status === "confirmed" ? "bg-teal-400" :
                      appt.status === "cancelled"  ? "bg-red-400"  : "bg-amber-400"
                    }`} />
                    <span className="text-sm text-slate-200 flex-1">
                      {appt.date} at {appt.time}
                      {appt.doctor_name && <span className="text-slate-500"> · {appt.doctor_name}</span>}
                    </span>
                    <span className={`badge border ${STATUS_STYLE[appt.status] || "bg-slate-800 text-slate-400 border-slate-700"}`}>
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preferences */}
          {summary.user_preferences && summary.user_preferences.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Patient Preferences
              </h3>
              <div className="flex flex-wrap gap-2">
                {summary.user_preferences.map((pref, i) => (
                  <span key={i} className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up warning */}
          {summary.follow_up_needed && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <span className="text-amber-400 text-lg flex-shrink-0">⚠</span>
              <p className="text-sm text-amber-200">Follow-up required for this patient.</p>
            </div>
          )}

          {/* Token usage & cost */}
          {(summary.tokens_used || summary.estimated_cost_usd !== undefined) && (
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Usage &amp; Cost
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {summary.tokens_used && (
                  <>
                    <div>
                      <p className="text-[10px] text-slate-600 mb-0.5">Input tokens</p>
                      <p className="text-sm font-mono font-semibold text-slate-300">
                        {summary.tokens_used.prompt_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 mb-0.5">Output tokens</p>
                      <p className="text-sm font-mono font-semibold text-slate-300">
                        {summary.tokens_used.completion_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 mb-0.5">Total tokens</p>
                      <p className="text-sm font-mono font-semibold text-slate-300">
                        {summary.tokens_used.total_tokens.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
                {summary.estimated_cost_usd !== undefined && (
                  <div>
                    <p className="text-[10px] text-slate-600 mb-0.5">Est. cost</p>
                    <p className="text-sm font-mono font-semibold text-teal-400">
                      ${summary.estimated_cost_usd < 0.001
                        ? summary.estimated_cost_usd.toFixed(6)
                        : summary.estimated_cost_usd.toFixed(4)}
                    </p>
                  </div>
                )}
              </div>
              {summary.model && (
                <p className="text-[10px] text-slate-700 mt-2.5">
                  Model: {summary.model}
                  {summary.provider && ` · ${summary.provider}`}
                </p>
              )}
            </div>
          )}

          {/* Duration */}
          {summary.call_duration_estimate && (
            <p className="text-xs text-slate-600 text-right">
              Duration: {summary.call_duration_estimate}
            </p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary flex-1">
            New Call
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
