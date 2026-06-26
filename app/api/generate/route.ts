// POST /api/generate
// Body: { imageDataUrl, productName, category, keywords }
//
// 1. Auth + credit check (intercept BEFORE any work if credits === 0).
// 2. Deduct 1 credit, upload original to Supabase Storage, create the listing
//    row with status 'processing', and return { listingId } immediately.
// 3. Run the pipeline (Remove.bg -> FAL x4 lifestyle -> Claude copy) kept alive
//    via waitUntil, updating the DB as it progresses. Client polls /api/status.

import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import { removeBackground } from "@/lib/removebg";
import { generateLifestyleImage, pickLifestylePrompts, type Gender } from "@/lib/fal";
import { generateCopy } from "@/lib/anthropic";

// Hobby plan caps function duration at 60s; bump this if you're on Vercel Pro.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    imageDataUrl?: string;
    productName?: string;
    category?: string;
    keywords?: string;
    gender?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageDataUrl, productName, category, keywords } = body;
  const gender: Gender = body.gender === "female" ? "female" : "male";
  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "A product image is required" }, { status: 400 });
  }
  if (!productName?.trim()) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  // --- Credit check (before any work) ---
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", user.id)
    .single();

  if (!profile || profile.credits_remaining < 1) {
    return NextResponse.json(
      { error: "You're out of credits.", code: "no_credits" },
      { status: 402 }
    );
  }

  // --- Deduct 1 credit ---
  const { error: creditError } = await supabase
    .from("profiles")
    .update({ credits_remaining: profile.credits_remaining - 1 })
    .eq("id", user.id);
  if (creditError) {
    return NextResponse.json({ error: "Could not reserve a credit" }, { status: 500 });
  }

  // --- Upload original + create listing ---
  let originalUrl: string;
  try {
    originalUrl = await uploadImage(imageDataUrl, "listinglab/originals");
  } catch (err) {
    console.error("original upload failed:", err);
    // refund the credit
    await supabase
      .from("profiles")
      .update({ credits_remaining: profile.credits_remaining })
      .eq("id", user.id);
    return NextResponse.json({ error: "Could not upload image" }, { status: 500 });
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert({
      user_id: user.id,
      product_name: productName.trim(),
      original_image_url: originalUrl,
      status: "processing",
    })
    .select("id")
    .single();

  if (listingError || !listing) {
    await supabase
      .from("profiles")
      .update({ credits_remaining: profile.credits_remaining })
      .eq("id", user.id);
    return NextResponse.json({ error: "Could not create listing" }, { status: 500 });
  }

  // --- Kick off the pipeline ---
  // waitUntil keeps the serverless function alive until the pipeline finishes
  // (on Vercel). Locally it falls back to fire-and-forget (the dev server stays
  // running anyway).
  const pipeline = runPipeline({
    listingId: listing.id,
    originalUrl,
    productName: productName.trim(),
    category: category?.trim() || "General",
    keywords: keywords?.trim() || "",
    gender,
  }).catch((err) => console.error("pipeline crashed:", err));

  try {
    waitUntil(pipeline);
  } catch {
    // Not in a Vercel context (e.g. local dev) — pipeline runs on its own.
  }

  return NextResponse.json({ listingId: listing.id });
}

// ---------------------------------------------------------------------------
// Background pipeline. Uses the admin (service-role) client so it can write
// regardless of request cookie context.
// ---------------------------------------------------------------------------
async function runPipeline(args: {
  listingId: string;
  originalUrl: string;
  productName: string;
  category: string;
  keywords: string;
  gender: Gender;
}) {
  const admin = createSupabaseAdminClient();
  const { listingId, originalUrl, productName, category, keywords, gender } = args;

  try {
    // STEP A — Background removal
    const cleanPngDataUrl = await removeBackground(originalUrl);
    const whiteBgUrl = await uploadImage(
      cleanPngDataUrl,
      "listinglab/white_bg"
    );

    // Extract raw base64 + mime for the image-editing model.
    const dataUrlMatch = cleanPngDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    const whiteBgMime = dataUrlMatch?.[1] || "image/png";
    const whiteBgBase64 = dataUrlMatch?.[2] || "";
    await admin.from("listing_images").insert({
      listing_id: listingId,
      type: "white_bg",
      image_url: whiteBgUrl,
    });

    // STEP B — Lifestyle images (4). Retry each once, continue on failure.
    const types = ["lifestyle_1", "lifestyle_2", "lifestyle_3", "lifestyle_4"] as const;
    const prompts = pickLifestylePrompts(gender, 4);
    // Run the 4 images in parallel so the whole pipeline fits within the
    // function timeout. Each is generated + stored + recorded independently
    // (retried once); a failure on one never affects the others or the copy.
    await Promise.all(
      prompts.map(async (prompt, i) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const genUrl = await generateLifestyleImage(whiteBgBase64, whiteBgMime, prompt);
            const storedUrl = await uploadImage(genUrl, "listinglab/lifestyle");
            await admin.from("listing_images").insert({
              listing_id: listingId,
              type: types[i],
              image_url: storedUrl,
            });
            return; // success
          } catch (err) {
            console.error(`Lifestyle attempt ${attempt + 1} failed (${gender} #${i + 1}):`, err);
          }
        }
      })
    );

    // STEP C — Copy
    const copy = await generateCopy({ productName, category, keywords });
    await admin.from("listing_copy").insert({
      listing_id: listingId,
      title: copy.title,
      bullet_1: copy.bullets[0] ?? "",
      bullet_2: copy.bullets[1] ?? "",
      bullet_3: copy.bullets[2] ?? "",
      bullet_4: copy.bullets[3] ?? "",
      bullet_5: copy.bullets[4] ?? "",
      description: copy.description,
      search_terms: copy.search_terms,
    });

    await admin.from("listings").update({ status: "complete" }).eq("id", listingId);
  } catch (err) {
    console.error("pipeline error:", err);
    await admin.from("listings").update({ status: "error" }).eq("id", listingId);
  }
}
