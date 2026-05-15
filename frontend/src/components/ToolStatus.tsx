import { useEffect, useRef } from "react";
import type { ToolEvent } from "../lib/api";

interface Props { events: ToolEvent[] }

const TOOL_META: Record<string, { label: string; color: string }> = {
  identify_user:         { label: "Identifying patient",      color: "#60a5fa" },
  fetch_doctors:         { label: "Fetching doctors",         color: "#a78bfa" },
  fetch_slots:           { label: "Checking availability",    color: "#818cf8" },
  book_appointment:      { label: "Booking appointment",      color: "#34d399" },
  retrieve_appointments: { label: "Loading appointments",     color: "#60a5fa" },
  cancel_appointment:    { label: "Cancelling appointment",   color: "#f87171" },
  modify_appointment:    { label: "Rescheduling",             color: "#fbbf24" },
  end_conversation:      { label: "Generating summary",       color: "#94a3b8" },
};

const TOOL_ICON: Record<string, string> = {
  identify_user: "👤", fetch_doctors: "🏥", fetch_slots: "📅",
  book_appointment: "✅", retrieve_appointments: "📋",
  cancel_appointment: "✕", modify_appointment: "✏️", end_conversation: "📝",
};

function Spinner({ color }: { color: string }) {
  return (
    <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

function formatData(data: Record<string, unknown>): string | null {
  const skip = new Set(["user_id", "found", "appointments", "doctors"]);
  const keys = Object.keys(data).filter(k => !skip.has(k));
  if (!keys.length) return null;
  return keys.slice(0, 3).map(k => {
    const v = data[k];
    if (Array.isArray(v)) return `${v.slice(0, 3).join(", ")}${v.length > 3 ? "…" : ""}`;
    if (typeof v === "object" && v !== null) return null;
    return String(v);
  }).filter(Boolean).join(" · ");
}

export default function ToolStatus({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0 flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-teal-500/20 flex items-center justify-center">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-slate-300">Live Activity</h2>
        {events.length > 0 && (
          <span className="ml-auto text-xs text-slate-600">{events.length}</span>
        )}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <p className="text-slate-600 text-sm">Actions will appear here</p>
          </div>
        ) : (
          events.map((ev, i) => {
            const meta = TOOL_META[ev.tool] || { label: ev.tool, color: "#94a3b8" };
            const detail = formatData(ev.data);

            return (
              <div
                key={i}
                className={`rounded-xl border p-3 transition-colors duration-200 ${
                  ev.status === "calling" ? "border-amber-500/25 bg-amber-500/5" :
                  ev.status === "success" ? "border-teal-500/20 bg-teal-500/5" :
                  ev.status === "error"   ? "border-red-500/20 bg-red-500/5"   :
                  "border-slate-700 bg-slate-800/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-shrink-0">{TOOL_ICON[ev.tool] || "⚙"}</span>
                  <span className="text-xs font-medium text-slate-200 flex-1 leading-tight">{meta.label}</span>
                  <span className="flex-shrink-0 flex items-center">
                    {ev.status === "calling" && <Spinner color={meta.color} />}
                    {ev.status === "success" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {ev.status === "error" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    )}
                  </span>
                </div>

                {ev.status === "success" && detail && (
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed truncate">{detail}</p>
                )}
                {ev.status === "error" && !!ev.data?.error && (
                  <p className="text-[11px] text-red-400 mt-1.5 leading-relaxed">{String(ev.data.error)}</p>
                )}
                <p className="text-[10px] text-slate-700 mt-1.5">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
