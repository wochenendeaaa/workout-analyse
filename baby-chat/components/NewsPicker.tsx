"use client";

import type { NewsArticle } from "@/lib/srf-news";

interface Props {
  articles: NewsArticle[];
  selected: NewsArticle | null;
  onSelect: (article: NewsArticle) => void;
}

export function NewsPicker({ articles, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {articles.map((article) => {
        const isSelected = selected?.link === article.link;
        return (
          <button
            key={article.link}
            onClick={() => onSelect(article)}
            className={`text-left rounded-2xl p-4 border-2 transition-all shadow-sm hover:shadow-md ${
              isSelected
                ? "border-pink-400 bg-pink-50 shadow-pink-100"
                : "border-gray-100 bg-white hover:border-pink-200"
            }`}
          >
            <p className="font-semibold text-sm text-gray-800 leading-snug line-clamp-2">
              {article.title}
            </p>
            {article.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {article.description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
