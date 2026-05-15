import { useState, useEffect, useCallback } from "react";
import {
  getDoctors, getCategories, getMonthlyAvailability,
  getSlots, getAppointments,
} from "../lib/api";
import type { Doctor, Category, ToolEvent, Appointment } from "../lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// One colour per doctor slot — cycles for 10 doctors
const DOC_COLORS = [
  { dot: "#34d399", bg: "rgba(52,211,153,0.10)",  text: "#6ee7b7", border: "rgba(52,211,153,0.22)"  },
  { dot: "#a78bfa", bg: "rgba(167,139,250,0.10)", text: "#c4b5fd", border: "rgba(167,139,250,0.22)" },
  { dot: "#fbbf24", bg: "rgba(251,191,36,0.10)",  text: "#fcd34d", border: "rgba(251,191,36,0.22)"  },
  { dot: "#38bdf8", bg: "rgba(56,189,248,0.10)",  text: "#7dd3fc", border: "rgba(56,189,248,0.22)"  },
  { dot: "#f87171", bg: "rgba(248,113,113,0.10)", text: "#fca5a5", border: "rgba(248,113,113,0.22)" },
  { dot: "#fb923c", bg: "rgba(251,146,60,0.10)",  text: "#fdba74", border: "rgba(251,146,60,0.22)"  },
  { dot: "#e879f9", bg: "rgba(232,121,249,0.10)", text: "#f0abfc", border: "rgba(232,121,249,0.22)" },
  { dot: "#67e8f9", bg: "rgba(103,232,249,0.10)", text: "#a5f3fc", border: "rgba(103,232,249,0.22)" },
  { dot: "#bef264", bg: "rgba(190,242,100,0.10)", text: "#d9f99d", border: "rgba(190,242,100,0.22)" },
  { dot: "#f9a8d4", bg: "rgba(249,168,212,0.10)", text: "#fce7f3", border: "rgba(249,168,212,0.22)" },
] as const;

type AvailLevel = "high" | "medium" | "low" | "none" | "past";

interface Props {
  toolEvents?: ToolEvent[];
  compact?: boolean;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function CalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 text-slate-600 flex-shrink-0"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CalendarView({ toolEvents = [], compact = false }: Props) {
  const today = new Date();

  function toDs(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  const todayStr = toDs(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Calendar navigation
  const [yr, setYr]                     = useState(today.getFullYear());
  const [mo, setMo]                     = useState(today.getMonth());      // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filter + data
  const [categories, setCategories]     = useState<Category[]>([]);
  const [catFilter, setCatFilter]       = useState<number | null>(null);   // null = All
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [avail, setAvail]               = useState<Record<string, number>>({});
  const [doctorSlots, setDoctorSlots]   = useState<{ doctor: Doctor; times: string[] }[]>([]);

  // Identified user
  const [userPhone, setUserPhone]             = useState<string | null>(null);
  const [userAppointments, setUserAppts]      = useState<Appointment[]>([]);

  // Loading flags
  const [loadSlots, setLoadSlots] = useState(false);
  const [loadMonth, setLoadMonth] = useState(false);

  // ── Load categories once ──
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // ── Load doctors (re-runs on catFilter change) ──
  useEffect(() => {
    getDoctors(undefined, catFilter ?? undefined).then(setDoctors).catch(() => {});
  }, [catFilter]);

  // ── Monthly availability ──
  const fetchMonth = useCallback(async () => {
    setLoadMonth(true);
    try {
      const data = await getMonthlyAvailability(yr, mo + 1, catFilter ?? undefined);
      setAvail(data);
    } catch { /* network errors are non-fatal */ }
    setLoadMonth(false);
  }, [yr, mo, catFilter]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  // ── Extract user phone from identify_user tool event ──
  useEffect(() => {
    for (let i = toolEvents.length - 1; i >= 0; i--) {
      const ev = toolEvents[i];
      if (ev.tool === "identify_user" && ev.status === "success" && ev.data?.user_id) {
        const phone = String(ev.data.user_id);
        setUserPhone(prev => (prev === phone ? prev : phone));
        break;
      }
    }
  }, [toolEvents]);

  // ── Load user appointments when phone becomes known ──
  const loadUserAppts = useCallback(async (phone: string) => {
    try { setUserAppts(await getAppointments(phone)); } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (userPhone) loadUserAppts(userPhone);
  }, [userPhone, loadUserAppts]);

  // ── Refresh calendar + user appointments on booking events ──
  useEffect(() => {
    const last = toolEvents[toolEvents.length - 1];
    if (!last || last.status !== "success") return;
    if (["book_appointment","cancel_appointment","modify_appointment"].includes(last.tool)) {
      fetchMonth();
      if (userPhone) loadUserAppts(userPhone);
    }
  }, [toolEvents, fetchMonth, userPhone, loadUserAppts]);

  // ── Per-doctor slots for the selected date ──
  const fetchSlots = useCallback(async (date: string) => {
    if (!date || doctors.length === 0) return;
    setLoadSlots(true);
    const results = await Promise.all(
      doctors.map(async (doc) => {
        try { const d = await getSlots(date, doc.id); return { doctor: doc, times: d.slots }; }
        catch { return { doctor: doc, times: [] as string[] }; }
      })
    );
    setDoctorSlots(results);
    setLoadSlots(false);
  }, [doctors]);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
    else setDoctorSlots([]);
  }, [selectedDate, fetchSlots]);

  // ── Calendar grid ──
  const firstWd = new Date(yr, mo, 1).getDay();
  const dim     = new Date(yr, mo + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...(Array(firstWd).fill(null) as null[]),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function getDs(day: number) { return toDs(yr, mo + 1, day); }

  function getLevel(day: number): AvailLevel {
    const ds = getDs(day);
    if (ds < todayStr) return "past";
    const count = avail[ds];
    if (count === undefined || count === 0) return "none";
    if (count >= 8) return "high";
    if (count >= 3) return "medium";
    return "low";
  }

  // Dates where the identified user has a confirmed appointment
  const userApptDates = new Set(
    userAppointments.filter(a => a.status === "confirmed").map(a => a.date)
  );

  function prev() {
    setSelectedDate(null);
    if (mo === 0) { setYr(y => y - 1); setMo(11); } else setMo(m => m - 1);
  }
  function next() {
    setSelectedDate(null);
    if (mo === 11) { setYr(y => y + 1); setMo(0); } else setMo(m => m + 1);
  }

  const DOT_BG: Record<AvailLevel, string> = {
    high: "#34d399", medium: "#fbbf24", low: "#f87171",
    none: "transparent", past: "transparent",
  };

  function catShort(cat: Category): string {
    // "General Medicine" → "General", "ENT" → "ENT", "Ophthalmology" → "Eyes" from display_name
    const m = cat.display_name.match(/\(([^)]+)\)/);
    return m ? m[1] : cat.name.split(" ")[0];
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="card flex flex-col overflow-hidden h-full">

      {/* ── Header ── */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-teal-400">
          <CalIcon />
          <span className="text-sm font-semibold text-slate-200">
            {compact ? "Availability" : "Appointment Calendar"}
          </span>
          {loadMonth && <SpinIcon />}
          {userPhone && (
            <span className="text-[10px] text-teal-500 bg-teal-500/10 border border-teal-500/20
                             px-2 py-0.5 rounded-full ml-1">
              Patient tracked
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400
                       hover:text-white hover:bg-slate-800 transition-colors text-xl font-light">
            ‹
          </button>
          <span className="text-xs font-semibold text-slate-300 w-[118px] text-center tabular-nums">
            {MONTHS[mo]} {yr}
          </span>
          <button onClick={next}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400
                       hover:text-white hover:bg-slate-800 transition-colors text-xl font-light">
            ›
          </button>
        </div>
      </div>

      {/* ── Category filter tabs ── */}
      <div className="border-b border-slate-800/60 flex-shrink-0 overflow-x-auto
                      scrollbar-none" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-1 px-2 py-1.5 min-w-max">
          {/* "All" tab */}
          <button
            onClick={() => { setCatFilter(null); setSelectedDate(null); }}
            className={[
              "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
              catFilter === null
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 border border-transparent",
            ].join(" ")}
          >
            All
          </button>

          {/* One tab per category */}
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCatFilter(cat.id); setSelectedDate(null); }}
              title={cat.display_name}
              className={[
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold",
                "transition-all whitespace-nowrap border",
                catFilter === cat.id
                  ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 border-transparent",
              ].join(" ")}
            >
              <span>{cat.icon}</span>
              {!compact && <span>{catShort(cat)}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="p-3 flex-shrink-0">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1.5">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-600 py-1 tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const ds      = getDs(day);
            const level   = getLevel(day);
            const isToday = ds === todayStr;
            const isSel   = ds === selectedDate;
            const isPast  = level === "past";
            const hasAvail = level !== "none" && level !== "past";
            const hasUserAppt = userApptDates.has(ds);

            return (
              <button
                key={i}
                disabled={isPast}
                onClick={() => !isPast && setSelectedDate(p => p === ds ? null : ds)}
                className={[
                  "relative flex flex-col items-center justify-center rounded-xl border transition-all duration-150",
                  compact ? "h-8" : "h-9",
                  isSel
                    ? "bg-teal-500/20 border-teal-500/40 text-teal-300 font-semibold"
                    : isToday
                    ? "border-slate-500/50 text-white font-semibold bg-slate-700/40 hover:bg-slate-700/60"
                    : isPast
                    ? "border-transparent text-slate-700 cursor-not-allowed"
                    : level === "none"
                    ? "border-transparent text-slate-600 hover:bg-slate-800/50"
                    : "border-transparent text-slate-300 hover:bg-slate-800/60 hover:border-slate-700/50 cursor-pointer",
                ].join(" ")}
              >
                <span className="text-[11px] leading-none">{day}</span>

                {/* Availability dot */}
                {hasAvail && !hasUserAppt && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full"
                    style={{ background: isSel ? "#2dd4bf" : DOT_BG[level] }} />
                )}

                {/* User appointment star — amber, overrides availability dot */}
                {hasUserAppt && !isPast && (
                  <span className="absolute bottom-0.5 text-[7px] leading-none text-amber-400">★</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-2.5 px-0.5 flex-wrap">
          {([
            ["#34d399", "Many slots"],
            ["#fbbf24", "Some slots"],
            ["#f87171", "Few slots"],
          ] as const).map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
              <span className="text-[10px] text-slate-600">{l}</span>
            </div>
          ))}
          {userPhone && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-400">★</span>
              <span className="text-[10px] text-slate-600">Your appointment</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Slot details panel ── */}
      <div className="flex-1 min-h-0 overflow-y-auto border-t border-slate-800/60">
        {!selectedDate ? (
          <div className="h-full flex items-center justify-center px-4 py-8">
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              Select a date to see<br />available slots per doctor
            </p>
          </div>
        ) : (
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-300 mb-3">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>

            {loadSlots ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                <SpinIcon /> Loading availability…
              </div>
            ) : doctorSlots.every(s => s.times.length === 0) && !userAppointments.some(
              a => a.date === selectedDate && a.status === "confirmed"
            ) ? (
              <p className="text-xs text-slate-600 italic py-2">
                No availability on this date.
              </p>
            ) : (
              <div className="space-y-2">
                {doctorSlots.map(({ doctor, times }, di) => {
                  // User's appointment with this doctor on selected date
                  const userAppt = userAppointments.find(
                    a =>
                      a.date === selectedDate &&
                      a.doctor_name === doctor.name &&
                      a.status === "confirmed"
                  );

                  if (times.length === 0 && !userAppt) return null;

                  const c = DOC_COLORS[di % DOC_COLORS.length];
                  return (
                    <div
                      key={doctor.id}
                      className="rounded-xl p-3"
                      style={{ background: c.bg, border: `1px solid ${c.border}` }}
                    >
                      {/* Doctor header */}
                      <div className="flex items-start gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                          style={{ background: c.dot }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: c.text }}>
                            {doctor.name}
                          </p>
                          <p className="text-[10px] text-slate-500">{doctor.specialization}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {times.length} open slot{times.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Available slots */}
                      {times.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {times.map(t => (
                            <span
                              key={t}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                              style={{
                                color: c.text,
                                background: "rgba(255,255,255,0.06)",
                                border: `1px solid ${c.border}`,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* User's confirmed appointment with this doctor */}
                      {userAppt && (
                        <div className="flex items-center gap-1.5 mt-1.5 bg-amber-500/10
                                        border border-amber-500/25 rounded-lg px-2.5 py-1.5">
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-[10px] font-semibold text-amber-300">
                            Your appointment at {userAppt.time}
                          </span>
                          <span className="ml-auto text-[9px] text-amber-500/70 uppercase tracking-wide">
                            Confirmed
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Appointments with doctors not currently in the filtered list */}
                {userAppointments
                  .filter(
                    a =>
                      a.date === selectedDate &&
                      a.status === "confirmed" &&
                      !doctorSlots.some(ds => ds.doctor.name === a.doctor_name)
                  )
                  .map((appt, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/25"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 text-sm">★</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-300">
                            {appt.doctor_name || "Doctor"}
                          </p>
                          <p className="text-[10px] text-amber-500/80">
                            {appt.category_name} · Your appointment at {appt.time}
                          </p>
                        </div>
                        <span className="ml-auto text-[9px] text-amber-500/70 uppercase tracking-wide">
                          Confirmed
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
