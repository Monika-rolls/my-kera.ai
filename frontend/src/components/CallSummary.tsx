import type { CallSummary } from "../lib/api";

interface Props {
  summary: CallSummary;
  onClose: () => void;
}

const SENTIMENT_STYLES = {
  positive: "text-teal-400 bg-teal-400/10",
  neutral: "text-slate-400 bg-slate-400/10",
  negative: "text-red-400 bg-red-400/10",
};

const INTENT_LABELS: Record<string, string> = {
  booking: "New Booking",
  cancellation: "Cancellation",
  modification: "Rescheduling",
  inquiry: "General Inquiry",
  mixed: "Mixed",
  unknown: "General",
};

export default function CallSummaryModal({ summary, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📝</span> Call Summary
            </h2>
            <p className="text-sm text-slate-400 mt-1">Generated at end of conversation</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Summary text */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-200 leading-relaxed">{summary.summary}</p>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.user_name && (
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Patient</p>
                <p className="text-sm font-medium text-white">{summary.user_name}</p>
              </div>
            )}
            {summary.phone_number && (
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Phone</p>
                <p className="text-sm font-medium text-white">{summary.phone_number}</p>
              </div>
            )}
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Intent</p>
              <p className="text-sm font-medium text-white">{INTENT_LABELS[summary.intent] || summary.intent}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Sentiment</p>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full capitalize ${SENTIMENT_STYLES[summary.sentiment]}`}>
                {summary.sentiment}
              </span>
            </div>
          </div>

          {/* Appointments */}
          {summary.appointments && summary.appointments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <span>📅</span> Appointments
              </h3>
              <div className="space-y-2">
                {summary.appointments.map((appt, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-4 py-3 border border-slate-800">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        appt.status === "confirmed" ? "bg-teal-400" :
                        appt.status === "cancelled" ? "bg-red-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-sm text-slate-200 flex-1">
                      {appt.date} at {appt.time}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      appt.status === "confirmed" ? "bg-teal-500/20 text-teal-300" :
                      appt.status === "cancelled" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"
                    }`}>
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
              <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <span>⭐</span> Patient Preferences
              </h3>
              <div className="flex flex-wrap gap-2">
                {summary.user_preferences.map((pref, i) => (
                  <span key={i} className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-full">
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {summary.follow_up_needed && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <span className="text-amber-400 text-lg">⚠️</span>
              <p className="text-sm text-amber-200">Follow-up required for this patient</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-0">
          <button onClick={onClose} className="btn-primary w-full">
            Close Summary
          </button>
        </div>
      </div>
    </div>
  );
}
