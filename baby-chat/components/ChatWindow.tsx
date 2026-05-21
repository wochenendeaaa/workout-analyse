"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/gemini-baby";
import type { NewsArticle } from "@/lib/srf-news";
import { MessageBubble } from "./MessageBubble";

interface Props {
  article: NewsArticle;
}

export function ChatWindow({ article }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const babyMsg: ChatMessage = { role: "baby", text: "" };
    setMessages([...next, babyMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, article }),
      });

      if (!res.body) throw new Error("No body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "baby", text: accumulated },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "baby", text: "babababa... ich konnte nichts sagen 😢" },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Article context pill */}
      <div className="text-xs text-pink-600 bg-pink-50 border border-pink-200 rounded-full px-4 py-1.5 text-center font-medium">
        Ihr redet über: {article.title}
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 min-h-[200px]">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Erkläre deinem Baby die Neuigkeiten... 👇
          </p>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streaming && messages[messages.length - 1]?.text === "" && (
          <div className="flex items-center gap-2">
            <div className="text-2xl">👶</div>
            <div className="bg-yellow-100 rounded-2xl rounded-bl-sm px-4 py-3 text-yellow-700 text-sm">
              <span className="animate-pulse">denkt nach...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 border-2 border-pink-200 rounded-full px-4 py-2 text-sm outline-none focus:border-pink-400 transition-colors"
          placeholder="Erkläre etwas deinem Baby..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={streaming}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="bg-pink-400 hover:bg-pink-500 disabled:opacity-50 text-white rounded-full px-5 py-2 text-sm font-semibold transition-colors"
        >
          Senden
        </button>
      </div>
    </div>
  );
}
