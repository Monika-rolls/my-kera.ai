import { useEffect, useRef } from "react";
import type { AgentState } from "../hooks/useVoiceAgent";

interface Props {
  state: AgentState;
  mouthOpenness: number; // 0–1
}

const STATE_COLORS: Record<AgentState, string> = {
  idle: "#475569",
  connecting: "#f59e0b",
  connected: "#14b8a6",
  speaking: "#14b8a6",
  listening: "#3b82f6",
  thinking: "#a855f7",
  ended: "#64748b",
};

const STATE_LABELS: Record<AgentState, string> = {
  idle: "Ready",
  connecting: "Connecting...",
  connected: "Connected",
  speaking: "Speaking",
  listening: "Listening",
  thinking: "Thinking...",
  ended: "Call ended",
};

export default function Avatar({ state, mouthOpenness }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blinkRef = useRef(0);
  const blinkTimerRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2 - 10;

    let blink = 0;
    let nextBlink = 2000 + Math.random() * 3000;
    let blinkPhase = 0; // 0=open, 1=closing, 2=opening
    let elapsed = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = now - last;
      last = now;
      elapsed += dt;

      // Blink logic
      if (blinkPhase === 0 && elapsed > nextBlink) {
        blinkPhase = 1;
        elapsed = 0;
      }
      if (blinkPhase === 1) {
        blink = Math.min(1, elapsed / 80);
        if (blink >= 1) { blinkPhase = 2; elapsed = 0; }
      }
      if (blinkPhase === 2) {
        blink = Math.max(0, 1 - elapsed / 80);
        if (blink <= 0) {
          blinkPhase = 0;
          elapsed = 0;
          nextBlink = 2000 + Math.random() * 4000;
        }
      }

      ctx.clearRect(0, 0, W, H);

      const color = STATE_COLORS[state];

      // Head shadow / glow
      const grd = ctx.createRadialGradient(cx, cy, 30, cx, cy, 110);
      grd.addColorStop(0, `${color}33`);
      grd.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.ellipse(cx, cy, 110, 110, 0, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Head
      const headGrd = ctx.createRadialGradient(cx - 15, cy - 20, 10, cx, cy, 75);
      headGrd.addColorStop(0, "#334155");
      headGrd.addColorStop(1, "#1e293b");
      ctx.beginPath();
      ctx.ellipse(cx, cy, 72, 85, 0, 0, Math.PI * 2);
      ctx.fillStyle = headGrd;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes
      const eyeY = cy - 20;
      const eyeOffsets = [-24, 24];
      for (const ex of eyeOffsets) {
        const eyeH = 10 * (1 - blink * 0.95);
        // White of eye
        ctx.beginPath();
        ctx.ellipse(cx + ex, eyeY, 11, eyeH + 1, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#e2e8f0";
        ctx.fill();
        // Iris
        ctx.beginPath();
        ctx.ellipse(cx + ex, eyeY, 7, Math.max(1, eyeH * 0.8), 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // Pupil
        ctx.beginPath();
        ctx.ellipse(cx + ex + 1, eyeY - 1, 4, Math.max(0.5, eyeH * 0.45), 0, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        // Eye shine
        ctx.beginPath();
        ctx.ellipse(cx + ex + 2, eyeY - 2, 2, Math.max(0.3, eyeH * 0.25), 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();
        // Eyelid (for blink)
        if (blink > 0.1) {
          ctx.beginPath();
          ctx.ellipse(cx + ex, eyeY - eyeH / 2, 12, eyeH * blink * 1.1, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#1e293b";
          ctx.fill();
        }
      }

      // Nose
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.quadraticCurveTo(cx + 8, cy + 8, cx + 5, cy + 12);
      ctx.quadraticCurveTo(cx, cy + 10, cx - 5, cy + 12);
      ctx.quadraticCurveTo(cx - 8, cy + 8, cx, cy - 5);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mouth
      const mouthY = cy + 38;
      const openAmount = state === "speaking" ? mouthOpenness : 0;
      const smileAmount = state === "idle" || state === "ended" ? 0.3 : 0.1;

      ctx.beginPath();
      if (openAmount > 0.05) {
        // Open mouth (speaking)
        const mH = openAmount * 22;
        ctx.ellipse(cx, mouthY, 22, mH / 2 + 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        // Teeth
        ctx.beginPath();
        ctx.rect(cx - 15, mouthY - mH / 2, 30, mH * 0.45);
        ctx.fillStyle = "#f1f5f9";
        ctx.fill();
        // Lips outline
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, 22, mH / 2 + 4, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Closed smile
        ctx.moveTo(cx - 20, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 14 * smileAmount + 6, cx + 20, mouthY);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Thinking dots
      if (state === "thinking") {
        const t = now / 400;
        for (let i = 0; i < 3; i++) {
          const dotY = H - 20 + Math.sin(t + i * 1.2) * 4;
          ctx.beginPath();
          ctx.arc(cx - 14 + i * 14, dotY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      // Listening indicator (sound waves)
      if (state === "listening") {
        for (let i = 1; i <= 3; i++) {
          const r = 90 + i * 12;
          const alpha = (0.5 - i * 0.12) * (0.6 + 0.4 * Math.sin(now / 300 + i));
          ctx.beginPath();
          ctx.arc(cx, cy, r, -0.4, Math.PI + 0.4);
          ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [state, mouthOpenness]);

  const glowClass =
    state === "speaking" || state === "connected" ? "glow-teal" :
    state === "listening" ? "glow-blue" :
    state === "thinking" ? "glow-amber" : "";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`rounded-full overflow-hidden transition-all duration-300 ${glowClass}`}>
        <canvas ref={canvasRef} width={240} height={260} className="block" />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full animate-pulse-slow"
          style={{ backgroundColor: STATE_COLORS[state] }}
        />
        <span className="text-sm text-slate-400 font-medium">{STATE_LABELS[state]}</span>
      </div>
    </div>
  );
}
