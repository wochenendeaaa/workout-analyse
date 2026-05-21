import { XMLParser } from "fast-xml-parser";

export interface NewsArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

const RSS_URL = "https://www.srf.ch/news/bnf/rss/1646";

export async function fetchSrfNews(): Promise<NewsArticle[]> {
  const res = await fetch(RSS_URL, {
    next: { revalidate: 300 },
    headers: { "User-Agent": "baby-chat/1.0" },
  });

  if (!res.ok) throw new Error(`SRF RSS fetch failed: ${res.status}`);

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const items: Record<string, string>[] = parsed?.rss?.channel?.item ?? [];

  return items.slice(0, 8).map((item) => ({
    title: stripHtml(String(item.title ?? "")),
    description: stripHtml(String(item.description ?? "")),
    link: String(item.link ?? ""),
    pubDate: String(item.pubDate ?? ""),
  }));
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}
