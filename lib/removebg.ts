// Remove.bg API helper (server-only).
// Takes an image URL, returns a PNG (with transparent background) as a data URL
// ready to upload to Cloudinary.

export async function removeBackground(imageUrl: string): Promise<string> {
  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": process.env.REMOVEBG_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      size: "auto",
      format: "png",
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json?.errors?.[0]?.title || "";
    } catch {
      /* ignore */
    }
    throw new Error(`Remove.bg failed (${res.status}). ${detail}`.trim());
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
