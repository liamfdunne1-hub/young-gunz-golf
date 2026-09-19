export function forceParagraphs(body: string): string {
  const cleaned = body.replace(/\r\n/g, "\n").trim();
  const existing = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (existing.length >= 4) return existing.join("\n\n");
  const sentences = cleaned
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return (chunks.length ? chunks : existing).join("\n\n");
}
