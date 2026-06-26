// GET /api/status/[id]
// Returns the listing's status plus whatever images/copy exist so far, so the
// client can render a live progress bar.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { ListingImage } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, product_name, status, original_image_url, user_id")
    .eq("id", params.id)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: images }, { data: copy }] = await Promise.all([
    supabase
      .from("listing_images")
      .select("type, image_url")
      .eq("listing_id", params.id),
    supabase
      .from("listing_copy")
      .select("*")
      .eq("listing_id", params.id)
      .maybeSingle(),
  ]);

  const imageMap: Record<string, string> = {};
  (images as Pick<ListingImage, "type" | "image_url">[] | null)?.forEach((img) => {
    if (img.image_url) imageMap[img.type] = img.image_url;
  });

  return NextResponse.json({
    status: listing.status,
    product_name: listing.product_name,
    original_image_url: listing.original_image_url,
    images: imageMap,
    copy: copy ?? null,
  });
}
