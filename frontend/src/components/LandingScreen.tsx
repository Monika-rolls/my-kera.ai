interface Props {
  onStart: () => void
  error: string | null
}

export default function LandingScreen({ onStart, error }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-12 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal/30 bg-teal/10">
          <svg
            className="h-5 w-5 text-teal"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <span className="font-mono text-sm font-medium tracking-widest text-slate-400 uppercase">
          Mykare Health
        </span>
      </div>

      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-4 text-5xl font-semibold tracking-tight text-slate-50 sm:text-6xl">
          Talk to{' '}
          <span
            className="text-teal"
            style={{ textShadow: '0 0 40px rgba(20,184,166,0.4)' }}
          >
            Mia
          </span>
        </h1>
        <p className="text-lg text-slate-400 font-light">
          Your AI-powered appointment assistant
        </p>
      </div>

      {/* Feature chips */}
      <div className="mb-12 flex flex-wrap justify-center gap-2">
        {['Book appointments', 'Check availability', 'Cancel or reschedule'].map(
          (f) => (
            <span
              key={f}
              className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 font-mono text-xs text-slate-500"
            >
              {f}
            </span>
          )
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        className="group relative flex items-center gap-3 rounded-2xl border border-teal/30 bg-teal/10 px-10 py-5 font-medium text-teal transition-all duration-300 hover:border-teal/60 hover:bg-teal/20 hover:shadow-teal-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
        style={{ fontSize: '1.1rem' }}
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-2xl border border-teal/20 animate-pulse-ring" />

        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/20 transition-transform duration-200 group-hover:scale-110">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
        Start Call
      </button>

      {/* Error */}
      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      <p className="mt-8 font-mono text-xs text-slate-600">
        Microphone access will be requested
      </p>
    </div>
  )
}
