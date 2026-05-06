import type { CallSummary } from '../types'

interface Props {
  summary: CallSummary
  onClose: () => void
  onNewCall: () => void
}

const INTENT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  booking:      { label: 'Booking',       color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  cancellation: { label: 'Cancellation',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  modification: { label: 'Modification',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  inquiry:      { label: 'Inquiry',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  mixed:        { label: 'Mixed',         color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  unknown:      { label: 'Unknown',       color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#14b8a6',
  neutral:  '#64748b',
  negative: '#ef4444',
}

export default function SummaryModal({ summary, onClose, onNewCall }: Props) {
  const intent = INTENT_STYLES[summary.intent] ?? INTENT_STYLES.unknown
  const sentimentColor = SENTIMENT_COLORS[summary.sentiment] ?? '#64748b'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-card p-6 shadow-2xl animate-fade-up"
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Call Summary</h2>
            {summary.call_duration_estimate && (
              <p className="font-mono text-xs text-slate-500 mt-0.5">
                Duration: {summary.call_duration_estimate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Intent badge */}
            <span
              className="rounded-full px-2.5 py-1 font-mono text-xs font-medium"
              style={{ color: intent.color, background: intent.bg, border: `1px solid ${intent.color}30` }}
            >
              {intent.label}
            </span>
            {/* Sentiment badge */}
            <span
              className="rounded-full px-2.5 py-1 font-mono text-xs capitalize"
              style={{ color: sentimentColor, background: `${sentimentColor}15`, border: `1px solid ${sentimentColor}30` }}
            >
              {summary.sentiment}
            </span>
          </div>
        </div>

        {/* Follow-up warning */}
        {summary.follow_up_needed && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <svg className="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-xs text-amber-400">Follow-up required for this patient</span>
          </div>
        )}

        {/* Patient info */}
        {(summary.user_name || summary.phone_number) && (
          <div className="mb-4 flex gap-3">
            {summary.user_name && (
              <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
                <p className="font-mono text-[10px] uppercase text-slate-600">Patient</p>
                <p className="text-sm font-medium text-slate-200">{summary.user_name}</p>
              </div>
            )}
            {summary.phone_number && (
              <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
                <p className="font-mono text-[10px] uppercase text-slate-600">Phone</p>
                <p className="font-mono text-sm text-slate-200">{summary.phone_number}</p>
              </div>
            )}
          </div>
        )}

        {/* Summary text */}
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-300">{summary.summary}</p>
        </div>

        {/* Appointments */}
        {Array.isArray(summary.appointments) && summary.appointments.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Appointments
            </p>
            <div className="flex flex-col gap-1.5">
              {(summary.appointments as Array<Record<string, unknown>>).map((appt, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-200">
                      {String(appt.date ?? '')} at {String(appt.time ?? '')}
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] capitalize"
                    style={{
                      color: appt.status === 'confirmed' ? '#14b8a6' : '#ef4444',
                      background: appt.status === 'confirmed' ? 'rgba(20,184,166,0.12)' : 'rgba(239,68,68,0.12)',
                    }}
                  >
                    {String(appt.status ?? 'unknown')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preferences */}
        {summary.user_preferences.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Preferences noted
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.user_preferences.map((pref, i) => (
                <span
                  key={i}
                  className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1 font-mono text-xs text-slate-400"
                >
                  {pref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onNewCall}
            className="flex-1 rounded-xl border border-teal/30 bg-teal/10 py-2.5 text-sm font-medium text-teal transition-all hover:bg-teal/20 hover:shadow-teal-glow"
          >
            New Call
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
