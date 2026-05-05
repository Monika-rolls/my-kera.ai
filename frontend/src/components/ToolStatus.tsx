import { useEffect, useRef } from "react";
import type { ToolEvent } from "../lib/api";

interface Props {
  events: ToolEvent[];
}

const TOOL_LABELS: Record<string, string> = {
  identify_user: "Identifying patient",
  fetch_slots: "Fetching available slots",
  book_appointment: "Booking appointment",
  retrieve_appointments: "Loading appointments",
  cancel_appointment: "Cancelling appointment",
  modify_appointment: "Rescheduling appointment",
  end_conversation: "Generating call summary",
};

const TOOL_ICONS: Record<string, string> = {
  identify_user: "👤",
  fetch_slots: "📅",
  book_appointment: "✅",
  retrieve_appointments: "📋",
  cancel_appointment: "❌",
  modify_appointment: "✏️",
  end_conversation: "📝",
};

function statusIcon(status: string) {
  if (status === "calling") return <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />;
  if (status === "success") return <span className="text-teal-400">✓</span>;
  if (status === "error") return <span className="text-red-400">✗</span>;
  return null;
}

function statusColor(status: string) {
  if (status === "calling") return "border-amber-500/30 bg-amber-500/5";
  if (status === "success") return "border-teal-500/30 bg-teal-500/5";
  if (status === "error") return "border-red-500/30 bg-red-500/5";
  return "border-slate-700 bg-slate-800/50";
}

function formatData(data: Record<string, unknown>): string | null {
  const keys = Object.keys(data).filter(k => !["user_id", "found"].includes(k));
  if (!keys.length) return null;
  return keys.slice(0, 3).map(k => {
    const v = data[k];
    if (Array.isArray(v)) return `${k}: [${(v as unknown[]).slice(0, 3).join(", ")}${v.length > 3 ? "…" : ""}]`;
    return `${k}: ${v}`;
  }).join(" · ");
}

export default function ToolStatus({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="text-teal-400">⚡</span> Live Activity
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">
            Tool calls will appear here during the conversation
          </div>
        ) : (
          events.map((ev, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 transition-all duration-300 ${statusColor(ev.status)}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{TOOL_ICONS[ev.tool] || "🔧"}</span>
                <span className="text-sm font-medium text-slate-200 flex-1">
                  {TOOL_LABELS[ev.tool] || ev.tool}
                </span>
                <span className="flex-shrink-0">{statusIcon(ev.status)}</span>
              </div>
              {ev.status === "success" && ev.data && Object.keys(ev.data).length > 0 && (
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {formatData(ev.data)}
                </p>
              )}
              {ev.status === "error" && ev.data?.error && (
                <p className="text-xs text-red-400 mt-1">{String(ev.data.error)}</p>
              )}
              <p className="text-xs text-slate-600 mt-1">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
