import { recapSystemPrompt, templateRecap, orlandoWeather, recapFacts, forceParagraphs, type RecapDraft } from "@/lib/golf/recap";
import type { Bootstrap } from "@/lib/golf/derive";

const MODELS = ["grok-3", "grok-3-mini", "grok-2-latest"];

function parseDraft(raw: string, fallback: RecapDraft): RecapDraft {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as Partial<RecapDraft>;
    if (!json.title || !json.body) return fallback;
    return {
      day: fallback.day,
      title: String(json.title).slice(0, 140),
      body: forceParagraphs(String(json.body).slice(0, 10000)),
      quote: String(json.quote ?? fallback.quote).slice(0, 320),
    };
  } catch {
    return fallback;
  }
}

export async function writeRecapWithAi(
  data: Bootstrap,
  day: string,
  apiKey: string | null,
): Promise<{ draft: RecapDraft; usedAi: boolean }> {
  const facts = recapFacts(data, day);
  const weather = facts.next ? await orlandoWeather(facts.next.date) : undefined;
  const fallback = templateRecap(data, day, weather);
  const key = apiKey?.trim();
  if (!key) return { draft: fallback, usedAi: false };
  let lastError = "";
  for (const model of MODELS) {
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 1.05,
          messages: [
            { role: "system", content: recapSystemPrompt() },
            { role: "user", content: JSON.stringify({ ...facts, weather }) },
          ],
        }),
      });
      if (!res.ok) {
        lastError = await res.text();
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (!content) continue;
      return { draft: parseDraft(content, fallback), usedAi: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "AI request failed";
    }
  }
  if (lastError) return { draft: fallback, usedAi: false };
  return { draft: fallback, usedAi: false };
}
