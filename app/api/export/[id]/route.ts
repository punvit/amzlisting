// GET /api/export/[id]
// Builds a ZIP containing all listing images + copy.txt, served as a download.

import { type NextRequest } from "next/server";
import JSZip from "jszip";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { ListingCopy, ListingImage } from "@/types";

export const maxDuration = 60;

function extFromUrl(url: string, fallback = "jpg"): string {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : fallback;
}

function buildCopyTxt(copy: ListingCopy | null, productName: string): string {
  if (!copy) return `Product: ${productName}\n(No copy generated.)\n`;
  const bullets = [
    copy.bullet_1,
    copy.bullet_2,
    copy.bullet_3,
    copy.bullet_4,
    copy.bullet_5,
  ]
    .filter(Boolean)
    .map((b, i) => `${i + 1}. ${b}`)
    .join("\n");

  return [
    `PRODUCT: ${productName}`,
    "",
    "TITLE",
    copy.title ?? "",
    "",
    "BULLET POINTS",
    bullets,
    "",
    "DESCRIPTION",
    copy.description ?? "",
    "",
    "BACKEND SEARCH TERMS",
    copy.search_terms ?? "",
    "",
  ].join("\n");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, product_name, user_id, status")
    .eq("id", params.id)
    .single();
  if (!listing || listing.user_id !== user.id) {
    return new Response("Not found", { status: 404 });
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

  const zip = new JSZip();
  const productName = listing.product_name || "listing";

  zip.file("copy.txt", buildCopyTxt(copy as ListingCopy | null, productName));

  const imgRows = (images ?? []) as Pick<ListingImage, "type" | "image_url">[];
  await Promise.all(
    imgRows.map(async (img) => {
      if (!img.image_url) return;
      try {
        const res = await fetch(img.image_url);
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        zip.file(`${img.type}.${extFromUrl(img.image_url)}`, buf);
      } catch {
        /* skip unreachable image */
      }
    })
  );

  const blob = await zip.generateAsync({ type: "nodebuffer" });
  const safeName = productName.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}_listing.zip"`,
    },
  });
}
