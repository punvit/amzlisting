// FAL.ai helper (server-only). Uses FLUX.1 Kontext [dev] image editing to place
// the product into a lifestyle scene while preserving its exact design.
//
// Prompt system: 10 male-oriented + 10 female-oriented scene prompts, all
// product-agnostic (they work for any product — kitchenware, gadgets, apparel,
// accessories, etc.). Every generation picks 4 random prompts from the
// COMBINED pool of 20, so each listing gets a varied mix of scenes.

import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

// Shared instruction appended to every scene prompt: keeps the product
// identical to the reference image and enforces Amazon-catalog quality.
// Exported so AI-generated scene prompts (lib/anthropic.ts) get the same lock.
export const PRODUCT_LOCK =
  " Keep the exact product from the reference image completely unchanged — same shape, colors, design, text, and materials. The product must be the clear focal point, sharp and well-lit. Photorealistic, premium quality, suitable for an Amazon product listing.";

export const MALE_PROMPTS = [
  "Create a premium flatlay on a dark wooden surface with masculine accessories — a leather wallet, luxury watch, sunglasses, and car keys arranged neatly around the product placed in the center. Cool, professional lighting with a sleek catalog-style composition." + PRODUCT_LOCK,
  "Create a lifestyle scene inside a modern coffee shop. A stylish young man sits at a table with his espresso, and the product is placed naturally on the table beside him. Natural window light with a candid, professional vibe." + PRODUCT_LOCK,
  "Generate a lifestyle image of a fit young man in smart-casual clothing holding or using the product naturally. Background is a modern urban street with soft depth-of-field blur. Confident, modern, high-quality feel." + PRODUCT_LOCK,
  "Generate a professional workspace scene where the product sits on a modern desk next to a laptop, a black coffee cup, and a notepad, with soft daylight coming from a window. Clean, sharp, and professional." + PRODUCT_LOCK,
  "Create a gym lifestyle scene with the product placed on a wooden bench next to a sports duffel bag, a towel, and a water bottle. Bright, energetic lighting with modern gym equipment softly blurred in the background." + PRODUCT_LOCK,
  "Create a premium car-interior scene with the product placed on the leather center console or dashboard of a luxury car. Warm ambient light, shallow depth of field, sophisticated and masculine mood." + PRODUCT_LOCK,
  "Generate an outdoor adventure scene with the product resting on a rock or wooden log beside a hiking backpack, with mountains and soft golden light in the background. Rugged but premium feel." + PRODUCT_LOCK,
  "Create a cozy living-room scene where a relaxed young man sits on a modern sofa and the product is placed on the coffee table in front of him next to a book and a mug. Warm evening lighting, natural and comfortable." + PRODUCT_LOCK,
  "Create a minimalist studio shelf scene with the product displayed among a few modern tech gadgets and a small plant, against a dark matte background with dramatic directional lighting. Sleek and premium." + PRODUCT_LOCK,
  "Generate a rooftop terrace scene at golden hour with the product placed on a table, a city skyline softly blurred behind it. Warm sunset tones, relaxed premium urban lifestyle." + PRODUCT_LOCK,
] as const;

export const FEMALE_PROMPTS = [
  "Create a neat, aesthetic flatlay on a white marble table with feminine accessories — rings, perfume, sunglasses, a bracelet, and a small purse arranged around the product placed in the center. Soft natural light, gentle shadows, premium catalog composition." + PRODUCT_LOCK,
  "Create a lifestyle scene inside a bright café. A stylish young woman sits with her latte, and the product is placed naturally on the table beside her cup. Warm café lighting with subtle background blur, modern and premium." + PRODUCT_LOCK,
  "Generate a lifestyle image of graceful feminine hands with neat nails holding or presenting the product against a soft, bright, modern background. Elegant, delicate, premium feel." + PRODUCT_LOCK,
  "Create a vanity-table scene with the product placed on a dressing table beside makeup brushes, a small mirror, and a scented candle, with warm bulb lighting around a mirror in the background. Cozy and glamorous." + PRODUCT_LOCK,
  "Create a cozy bedroom scene with the product placed on a nightstand or on pastel bedding, with soft fairy lights and a warm, dreamy atmosphere. Aesthetic, comfortable, and inviting." + PRODUCT_LOCK,
  "Generate an outdoor café scene with the product on a stylish table next to a notebook, sunglasses, and a small plant pot, with warm natural sunlight and a relaxed real-life vibe." + PRODUCT_LOCK,
  "Create a shopping-day scene with the product placed beside elegant gift bags and boxes on a clean pastel surface, with soft studio lighting. Fresh, joyful, premium retail feel." + PRODUCT_LOCK,
  "Create a wellness scene with the product placed beside a rolled yoga mat, a water bottle, and green plants, in bright morning light. Calm, healthy, aspirational atmosphere." + PRODUCT_LOCK,
  "Generate a bright kitchen-counter scene with the product placed near a bowl of fruit, fresh flowers in a vase, and a cup of tea, with natural daylight streaming in. Clean, homely, premium lifestyle feel." + PRODUCT_LOCK,
  "Create a picnic scene in a park with the product placed on a woven blanket beside a basket and wildflowers, in soft golden afternoon light. Relaxed, warm, and aesthetic." + PRODUCT_LOCK,
] as const;

// Picks `count` distinct prompts at random from the COMBINED male + female
// pool (unbiased Fisher-Yates shuffle), so every listing gets a mixed set.
export function pickLifestylePrompts(count = 4): string[] {
  const pool = [...MALE_PROMPTS, ...FEMALE_PROMPTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// `imageBase64` is the raw base64 (no data URL prefix) of the white-background
// product image. `prompt` is a full standalone prompt. Returns the URL of the
// generated lifestyle image.
export async function generateLifestyleImage(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const imageDataUri = `data:${mimeType};base64,${imageBase64}`;

  // FLUX.1 Kontext [dev]: instruction-based image editing that keeps the exact
  // product from the reference image and rebuilds the scene. ~$0.025/MP — the
  // cheap option that still preserves the product.
  const result = await fal.subscribe("fal-ai/flux-kontext/dev", {
    input: {
      image_url: imageDataUri,
      prompt,
      num_inference_steps: 28,
      guidance_scale: 2.5,
      resolution_mode: "1:1", // square, ideal for Amazon images
      output_format: "jpeg",
      // Return the image inline as a data URI so we don't have to download it
      // from fal.media afterwards (avoids CDN connect timeouts).
      sync_mode: true,
      seed: Math.floor(Math.random() * 1_000_000),
    },
  });

  const data = result.data as { images?: Array<{ url?: string }> };
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error("FAL.ai returned no image");
  return url;
}
