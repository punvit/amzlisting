// Image storage via Supabase Storage (server-only). Uploads to a public bucket
// and returns the public URL. Replaces Cloudinary.

import { createSupabaseAdminClient } from "@/lib/supabase";

const BUCKET = "listings";

// `source` may be a data URL (data:image/...;base64,...) or a remote http(s)
// URL. Returns the public URL of the stored object.
export async function uploadImage(
  source: string,
  folder = "misc"
): Promise<string> {
  const admin = createSupabaseAdminClient();

  let buffer: Buffer;
  let contentType = "image/png";

  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) throw new Error("Invalid data URL");
    contentType = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
    contentType = res.headers.get("content-type") || "image/jpeg";
    buffer = Buffer.from(await res.arrayBuffer());
  }

  const ext = contentType.split("/")[1]?.split("+")[0] || "png";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
