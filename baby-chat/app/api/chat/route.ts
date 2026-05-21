import { streamBabyReply, ChatMessage } from "@/lib/gemini-baby";
import type { NewsArticle } from "@/lib/srf-news";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages, article }: { messages: ChatMessage[]; article: NewsArticle } =
    await req.json();

  if (!article || !messages?.length) {
    return new Response("Missing messages or article", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of streamBabyReply(article, messages)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("Gemini stream error:", err);
        controller.enqueue(encoder.encode("\n\n[babababa... etwas ist schiefgelaufen 😢]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
