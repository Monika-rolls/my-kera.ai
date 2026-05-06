import { useEffect, useRef } from 'react'
import type { ToolEvent } from '../types'

interface Props {
  events: ToolEvent[]
}

const TOOL_ICONS: Record<string, string> = {
  identify_user: '👤',
  fetch_slots: '📅',
  book_appointment: '✅',
  retrieve_appointments: '📋',
  cancel_appointment: '❌',
  modify_appointment: '✏️',
  end_conversation: '📝',
}

const TOOL_LABELS: Record<string, string> = {
  identify_user: 'Identifying patient',
  fetch_slots: 'Fetching slots',
  book_appointment: 'Booking appointment',
  retrieve_appointments: 'Retrieving appointments',
  cancel_appointment: 'Cancelling appointment',
  modify_appointment: 'Rescheduling',
  end_conversation: 'Ending conversation',
}

function getSnippet(ev: ToolEvent): string | null {
  const d = ev.data
  if (ev.tool === 'book_appointment' && ev.status === 'success' && d.date) {
    return `${d.date as string} at ${d.time as string}`
  }
  if (ev.tool === 'fetch_slots' && ev.status === 'success' && Array.isArray(d.available_slots)) {
    return `${(d.available_slots as string[]).length} slots on ${d.date as string}`
  }
  if (ev.tool === 'identify_user' && ev.status === 'success') {
    return d.name ? `${d.name as string}` : `+${ev.data.phone_number as string}`
  }
  if (ev.tool === 'book_appointment' && ev.status === 'error') {
    return d.error as string
  }
  return null
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

export default function ActivityFeed({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  if (events.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
          <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p className="font-mono text-xs text-slate-600">Agent activity will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {events.map((ev, i) => {
        const snippet = getSnippet(ev)
        const isError = ev.status === 'error'
        const isCalling = ev.status === 'calling'

        return (
          <div
            key={i}
            className="animate-slide-in flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/50 px-3 py-2.5"
          >
            <span className="mt-0.5 text-base leading-none shrink-0">
              {TOOL_ICONS[ev.tool] ?? '⚙️'}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-medium ${
                    isError ? 'text-red-400' : isCalling ? 'text-amber-400' : 'text-teal'
                  }`}
                >
                  {TOOL_LABELS[ev.tool] ?? ev.tool}
                </span>
                <span className="font-mono text-[10px] text-slate-600 shrink-0">
                  {formatTime(ev.timestamp)}
                </span>
              </div>

              {snippet && (
                <p className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">{snippet}</p>
              )}
            </div>

            {/* Status indicator */}
            <div className="mt-0.5 shrink-0">
              {isCalling && (
                <svg
                  className="h-3.5 w-3.5 text-amber-400 spin-ring"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {ev.status === 'success' && (
                <svg className="h-3.5 w-3.5 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {isError && (
                <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
