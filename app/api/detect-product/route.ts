// POST /api/detect-product
// Body: { imageDataUrl: string }  (data URL of the uploaded product image)
// Returns: { detected_name, suggested_category }

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { detectProduct } from "@/lib/anthropic";

// Lightweight per-user rate limit so authenticated users can't loop this
// endpoint and burn the Anthropic budget (detection is free / uncredited).
// NOTE: in-memory, so it's per serverless instance — a basic first line of
// defense, not a hard guarantee. For strict limits use Upstash/Redis.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10; // requests per user per minute
const rateHits = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateHits.get(userId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateHits.set(userId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

export async function POST(request: NextRequest) {
  // Require an authenticated user.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  let imageDataUrl: string | undefined;
  try {
    const body = await request.json();
    imageDataUrl = body.imageDataUrl;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "A valid image data URL is required" },
      { status: 400 }
    );
  }

  try {
    const result = await detectProduct(imageDataUrl);
    return NextResponse.json(result);
  } catch (err) {
    console.error("detect-product error:", err);
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Product detection failed: ${detail}` },
      { status: 500 }
    );
  }
}
