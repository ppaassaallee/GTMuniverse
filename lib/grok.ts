import "server-only";

// Grok (xAI) is Boldr's AI backend. The API is OpenAI-compatible; calls run on the server only,
// so XAI_API_KEY never reaches the browser.

const BASE_URL = process.env.XAI_BASE_URL || "https://api.x.ai/v1";
export const GROK_MODEL = process.env.XAI_MODEL || "grok-4";

export class GrokError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export function grokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function grokChat(messages: Message[], opts: { json?: boolean; temperature?: number } = {}): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new GrokError("Grok isn't connected. Set XAI_API_KEY on the server.", 503);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        temperature: opts.temperature ?? 0.4,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new GrokError(`Couldn't reach Grok: ${(e as Error).message}`, 502);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GrokError(`Grok returned ${res.status}: ${detail.slice(0, 300)}`, res.status === 429 ? 429 : 502);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new GrokError("Grok returned an empty answer.", 502);
  return text;
}

/** Ask Grok for a JSON object and parse it, tolerating a fenced reply. */
export async function grokJSON<T>(system: string, user: string): Promise<T> {
  const text = await grokChat([{ role: "system", content: system }, { role: "user", content: user }], { json: true });
  return parseJSON<T>(text);
}

export function parseJSON<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  try {
    return JSON.parse(body) as T;
  } catch {
    const start = body.search(/[{[]/);
    const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1)) as T;
    throw new GrokError("Grok's answer wasn't valid JSON.", 502);
  }
}
