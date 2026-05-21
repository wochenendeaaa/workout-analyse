"use client";

import type { ChatMessage } from "@/lib/gemini-baby";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isBaby = message.role === "baby";

  return (
    <div className={`flex items-end gap-2 ${isBaby ? "justify-start" : "justify-end"}`}>
      {isBaby && (
        <div className="text-2xl mb-1 select-none" aria-hidden>👶</div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isBaby
            ? "bg-yellow-100 text-yellow-900 rounded-bl-sm"
            : "bg-blue-500 text-white rounded-br-sm"
        }`}
      >
        {message.text}
      </div>
      {!isBaby && (
        <div className="text-2xl mb-1 select-none" aria-hidden>🧑‍🍼</div>
      )}
    </div>
  );
}
