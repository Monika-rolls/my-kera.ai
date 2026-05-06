import type { AgentState, ToolEvent, TranscriptEntry } from '../types'
import Avatar from './Avatar'
import Transcript from './Transcript'
import ActivityFeed from './ActivityFeed'

interface Props {
  state: AgentState
  transcript: TranscriptEntry[]
  toolEvents: ToolEvent[]
  volumeRef: React.RefObject<number>
  onEnd: () => void
  onShowSummary: () => void
  hasSummary: boolean
}

const CONNECTING_STATES: AgentState[] = ['connecting']

export default function CallScreen({
  state,
  transcript,
  toolEvents,
  volumeRef,
  onEnd,
  onShowSummary,
  hasSummary,
}: Props) {
  const isConnecting = CONNECTING_STATES.includes(state)

  if (isConnecting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <span className="h-2 w-2 rounded-full bg-teal animate-dot-1" />
            <span className="h-2 w-2 rounded-full bg-teal animate-dot-2" />
            <span className="h-2 w-2 rounded-full bg-teal animate-dot-3" />
          </div>
          <p className="font-mono text-xs tracking-widest text-slate-500 uppercase">
            Connecting to Mia…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-800/60 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal/30 bg-teal/10">
            <svg className="h-3.5 w-3.5 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="font-mono text-xs font-medium tracking-widest text-slate-400 uppercase">
            Mykare Health
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
          <span className="font-mono text-xs text-teal tracking-widest uppercase">Live</span>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="flex w-[30%] flex-col border-r border-slate-800/60 p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Conversation
          </h2>
          <div className="flex-1 overflow-hidden">
            <Transcript entries={transcript} />
          </div>
        </div>

        {/* Center: Avatar + Controls */}
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
          <Avatar state={state} volumeRef={volumeRef} />

          {/* Controls */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onEnd}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              End Call
            </button>

            {hasSummary && (
              <button
                onClick={onShowSummary}
                className="font-mono text-xs text-slate-500 hover:text-teal transition-colors underline underline-offset-2"
              >
                View Summary
              </button>
            )}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="flex w-[30%] flex-col border-l border-slate-800/60 p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Agent Activity
          </h2>
          <div className="flex-1 overflow-hidden">
            <ActivityFeed events={toolEvents} />
          </div>
        </div>
      </div>
    </div>
  )
}
