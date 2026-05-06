import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '../types'

interface Props {
  entries: TranscriptEntry[]
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function Transcript({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
          <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="font-mono text-xs text-slate-600">Conversation will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {entries.map((entry, i) => (
        <div
          key={i}
          className={`flex animate-fade-up flex-col gap-1 ${
            entry.role === 'user' ? 'items-end' : 'items-start'
          }`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              entry.role === 'user'
                ? 'rounded-br-sm bg-accent-blue/15 text-slate-200 border border-accent-blue/20'
                : 'rounded-bl-sm bg-slate-800/60 text-slate-300 border border-slate-700/50'
            }`}
          >
            {entry.content}
          </div>
          <span className="font-mono text-[10px] text-slate-600 px-1">
            {entry.role === 'user' ? 'You' : 'Mia'} · {formatTime(entry.timestamp)}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
