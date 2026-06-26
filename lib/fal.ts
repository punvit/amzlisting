// FAL.ai helper (server-only). Uses FLUX.1 Kontext [dev] image editing to place
// the product into a lifestyle scene while preserving its exact design.

import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export type Gender = "male" | "female";

export const MALE_PROMPTS = [
  "Create a premium flatlay on a dark wooden or concrete surface. Include masculine lifestyle accessories such as a leather wallet, luxury watch, sunglasses, and car keys arranged neatly. Place the phone with the exact back-cover design from the reference image in the center. Use cool, professional lighting and a sleek catalog-style composition. Ensure the focus stays on the phone case without altering its original look.",
  "Create a lifestyle scene inside a modern coffee shop. A stylish young man is sitting with his espresso, casually checking his phone. The phone must display the same back-cover design exactly as in the reference image. Use natural lighting with a professional, candid vibe suitable for Amazon catalog lifestyle use.",
  "Generate a lifestyle image of a fit young man holding the phone with the exact back cover design. He is wearing a smart casual outfit. Background should be an urban street or modern office building. Focus on a strong, confident grip and the premium look of the case. The image should feel modern and high-quality.",
  "Generate a professional workspace lifestyle image where the phone with the exact back cover from the reference image is kept on a modern desk next to a MacBook, a black coffee cup, and a notepad. Add soft daylight coming from a window. The case should look professional, sharp, and highlighted naturally.",
] as const;

export const FEMALE_PROMPTS = [
  "Create a neat and aesthetic flatlay on a wooden or marble table. Include lifestyle accessories such as rings, perfume, sunglasses, bracelets, a purse, and a coffee cup arranged neatly. Place the phone with the exact back-cover design from the reference image in the center. Use soft natural light, gentle shadows, and a premium catalog-style composition. Ensure the focus stays on the phone case without altering its original look.",
  "Create a lifestyle scene inside a Starbucks café. A stylish young woman is sitting with her coffee and naturally showing her phone toward the camera. The phone must display the same back-cover design exactly as in the reference image. Use warm café lighting with subtle background blur. The image should feel modern, premium, and suitable for Amazon catalog lifestyle use.",
  "Generate a lifestyle image of a stylish young woman holding a luxury glitter back cover with golden 3D butterfly design reference image in her beautiful feminine hands. Background should be soft, bright, modern and aesthetic. Hands should look graceful with neat nails. The case should shine with sparkles and golden highlights. Focus on elegance and premium feel suitable for Amazon listing.",
  "Generate an everyday urban lifestyle image where the phone with the exact back cover from the reference image is kept on a stylish outdoor café table next to a notebook, pen, sunglasses, and a plant pot. Add warm natural sunlight and a relaxed real-life vibe. The case should look premium, clear, and highlighted naturally.",
] as const;

// Picks `count` distinct prompts at random from the selected gender's set.
export function pickLifestylePrompts(gender: Gender, count = 3): string[] {
  const pool = gender === "female" ? FEMALE_PROMPTS : MALE_PROMPTS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
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
