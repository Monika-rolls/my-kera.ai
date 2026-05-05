import { useEffect, useRef } from "react";
import type { Message } from "../lib/api";

interface Props {
  messages: Message[];
}

export default function TranscriptPanel({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="text-blue-400">💬</span> Conversation
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">
            The conversation transcript will appear here
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-teal-900 border border-teal-700 flex items-center justify-center flex-shrink-0 text-sm">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center flex-shrink-0 text-sm">
                  👤
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
