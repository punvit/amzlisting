// POST /api/detect-product
// Body: { imageDataUrl: string }  (data URL of the uploaded product image)
// Returns: { detected_name, suggested_category }

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { detectProduct } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  // Require an authenticated user.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
