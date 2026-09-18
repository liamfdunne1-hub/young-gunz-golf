import { recapSystemPrompt, templateRecap, type RecapDraft } from "@/lib/golf/recap";
import { recapFacts } from "@/lib/golf/recap";
import type { Bootstrap } from "@/lib/golf/derive";

const MODELS = ["grok-3-mini", "grok-3", "grok-2-latest"];

function parseDraft(raw: string, fallback: RecapDraft): RecapDraft {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as Partial<RecapDraft>;
    if (!json.title || !json.body) return fallback;
    return {
      day: fallback.day,
      title: String(json.title).slice(0, 120),
      body: String(json.body).slice(0, 8000),
      quote: String(json.quote ?? fallback.quote).slice(0, 280),
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
  const fallback = templateRecap(data, day);
  const key = apiKey?.trim();
  if (!key) return { draft: fallback, usedAi: false };

  const facts = recapFacts(data, day);
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
          temperature: 0.7,
          messages: [
            { role: "system", content: recapSystemPrompt() },
            { role: "user", content: JSON.stringify(facts) },
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
  if (lastError) {
    return {
      draft: {
        ...fallback,
        body: `${fallback.body}\n\n(The recap desk wrote this from the numbers. The AI key was present but the model did not answer.)`,
      },
      usedAi: false,
    };
  }
  return { draft: fallback, usedAi: false };
}
