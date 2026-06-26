// Anthropic Claude helpers (server-only). Uses claude-haiku for both
// vision-based product detection and listing copy generation.

import Anthropic from "@anthropic-ai/sdk";

// If this model string ever 404s, try "claude-haiku-4-5-20251001".
const MODEL = "claude-haiku-4-5";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// Pulls the first JSON object out of a model response, tolerating ```json
// fences or surrounding prose.
function parseJsonObject<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

function getTextBlock(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export interface DetectedProduct {
  detected_name: string;
  suggested_category: string;
}

// `imageDataUrl` is a data URL (e.g. "data:image/png;base64,....").
export async function detectProduct(
  imageDataUrl: string
): Promise<DetectedProduct> {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL");
  const mediaType = match[1] as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";
  const data = match[2];

  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are a product identification assistant for an e-commerce listing tool. " +
      "Look at the product image and return strict JSON with two keys: " +
      "detected_name (a concise, specific product name, e.g. 'Stainless Steel Insulated Water Bottle') " +
      "and suggested_category (a single Amazon-style category, e.g. 'Home & Kitchen'). " +
      "Return ONLY the JSON object, no prose.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data },
          },
          { type: "text", text: "Identify this product." },
        ],
      },
    ],
  });

  const parsed = parseJsonObject<Partial<DetectedProduct>>(getTextBlock(message));
  return {
    detected_name: parsed.detected_name?.trim() || "Unknown product",
    suggested_category: parsed.suggested_category?.trim() || "General",
  };
}

export interface GeneratedCopy {
  title: string;
  bullets: string[];
  description: string;
  search_terms: string;
}

export async function generateCopy(args: {
  productName: string;
  category: string;
  keywords: string;
}): Promise<GeneratedCopy> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      "You are an expert Amazon listing copywriter. Write human-sounding, " +
      "conversion-optimized copy. Avoid: em dashes, 'elevate', 'unleash', " +
      "'in today's world', generic filler phrases. Vary sentence length. " +
      "Sound confident and direct.",
    messages: [
      {
        role: "user",
        content:
          `Product: ${args.productName}. Category: ${args.category}. ` +
          `Target keywords: ${args.keywords}. ` +
          "Write: 1 title (under 200 chars, brand+feature+type format), " +
          "5 bullet points (each starting with a 2-3 word caps hook then benefit+spec), " +
          "1 short description (2 paragraphs, conversational), " +
          "backend search terms (under 250 bytes, no repeats). " +
          "Return ONLY JSON with keys: title, bullets (array of 5 strings), description, search_terms.",
      },
    ],
  });

  const parsed = parseJsonObject<Partial<GeneratedCopy>>(getTextBlock(message));
  const bullets = Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 5) : [];
  while (bullets.length < 5) bullets.push("");

  return {
    title: parsed.title?.trim() || args.productName,
    bullets,
    description: parsed.description?.trim() || "",
    search_terms: parsed.search_terms?.trim() || "",
  };
}
