"use client";

import { useEffect, useState } from "react";
import type { NewsArticle } from "@/lib/srf-news";
import { NewsPicker } from "@/components/NewsPicker";
import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setArticles(data);
        else setError("Nachrichten konnten nicht geladen werden.");
      })
      .catch(() => setError("Netzwerkfehler beim Laden der Nachrichten."))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(article: NewsArticle) {
    setSelected((prev) => (prev?.link === article.link ? null : article));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">👶</div>
        <h1 className="text-3xl font-extrabold text-pink-500 tracking-tight">
          Baby Nachrichten Chat
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          Wähl eine Nachricht aus und erkläre sie deinem Baby!
        </p>
      </div>

      {/* News picker */}
      <section className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
          Aktuelle SRF Nachrichten
        </h2>
        {loading && (
          <div className="text-center text-pink-300 py-12 text-sm animate-pulse">
            Nachrichten werden geladen...
          </div>
        )}
        {error && (
          <div className="text-center text-red-400 py-8 text-sm">{error}</div>
        )}
        {!loading && !error && (
          <NewsPicker articles={articles} selected={selected} onSelect={handleSelect} />
        )}
      </section>

      {/* Chat */}
      {selected && (
        <section className="bg-white rounded-3xl shadow-lg p-6 border border-pink-100">
          <ChatWindow key={selected.link} article={selected} />
        </section>
      )}

      <p className="text-center text-xs text-gray-300 mt-10">
        Powered by SRF Nachrichten & Gemini ✨
      </p>
    </main>
  );
}
