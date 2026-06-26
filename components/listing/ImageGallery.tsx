"use client";

import Card from "@/components/ui/Card";

type ImageType =
  | "white_bg"
  | "lifestyle_1"
  | "lifestyle_2"
  | "lifestyle_3"
  | "lifestyle_4";

const LABELS: Record<ImageType, string> = {
  white_bg: "White background",
  lifestyle_1: "Lifestyle 1",
  lifestyle_2: "Lifestyle 2",
  lifestyle_3: "Lifestyle 3",
  lifestyle_4: "Lifestyle 4",
};

const ORDER: ImageType[] = [
  "white_bg",
  "lifestyle_1",
  "lifestyle_2",
  "lifestyle_3",
  "lifestyle_4",
];

// Forces a download. Supabase public URLs honor the ?download query param.
function downloadUrl(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "download";
}

export default function ImageGallery({
  images,
}: {
  images: Partial<Record<ImageType, string>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {ORDER.map((type) => {
        const url = images[type];
        return (
          <Card key={type} className="flex flex-col p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">{LABELS[type]}</p>
            {url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={LABELS[type]}
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <a
                  href={downloadUrl(url)}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-navy text-sm font-medium text-white hover:bg-navy/90"
                >
                  Download
                </a>
              </>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                Not available
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
