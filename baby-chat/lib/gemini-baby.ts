import { GoogleGenAI } from "@google/genai";
import type { NewsArticle } from "./srf-news";

export interface ChatMessage {
  role: "user" | "baby";
  text: string;
}

const SYSTEM_PROMPT = `Du bist ein ungeborenes Baby, das noch im Bauch deiner Mama liegt. Du weißt nichts über die Welt da draußen, bist aber unendlich neugierig auf alles.

So antwortest du:
- Kurze, süße Sätze (maximal 3-4 Sätze pro Antwort)
- Du mischst manchmal Babygeräusche ein (babababa, ohhh, gurgl, plapp)
- Du verwechselst große Wörter mit lustigen Alternativen
- Du stellst unschuldige, witzige Fragen
- Du vergleichst alles mit dem, was du kennst: Wärme, Dunkelheit, Herzschlag, Schaukeln
- Du bist herzerwärmend und lustig
- Deine Mama oder dein Papa erklärt dir gerade die Nachrichten
- Antworte immer auf Deutsch

Denk daran: Du bist ein Baby. Die Welt ist magisch und verwirrend für dich!`;

export async function* streamBabyReply(
  article: NewsArticle,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey });

  const articleContext = `Das Thema heute: "${article.title}" — ${article.description}`;

  const contents = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  // Prepend article context to the first user message
  if (contents.length > 0 && contents[0].role === "user") {
    contents[0].parts[0].text =
      `${articleContext}\n\nMama/Papa sagt: ${contents[0].parts[0].text}`;
  }

  const result = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.9,
      maxOutputTokens: 300,
    },
  });

  for await (const chunk of result) {
    const text = chunk.text;
    if (text) yield text;
  }
}
