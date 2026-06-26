// PATCH /api/copy
// Body: { listingId, patch: { title?, bullet_1?..bullet_5?, description?, search_terms? } }
// Updates the listing_copy row. RLS ensures the user owns the parent listing.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "title",
  "bullet_1",
  "bullet_2",
  "bullet_3",
  "bullet_4",
  "bullet_5",
  "description",
  "search_terms",
] as const;

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { listingId?: string; patch?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { listingId, patch } = body;
  if (!listingId || !patch || typeof patch !== "object") {
    return NextResponse.json({ error: "listingId and patch are required" }, { status: 400 });
  }

  // Whitelist fields.
  const update: Record<string, string> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in patch) update[field] = String(patch[field] ?? "");
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Verify ownership (defense-in-depth alongside RLS).
  const { data: listing } = await supabase
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .single();
  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("listing_copy")
    .update(update)
    .eq("listing_id", listingId);

  if (error) {
    return NextResponse.json({ error: "Could not save changes" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
