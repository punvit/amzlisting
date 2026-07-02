"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import ImageGallery from "@/components/listing/ImageGallery";
import CopyEditor from "@/components/listing/CopyEditor";
import ExportButton from "@/components/listing/ExportButton";
import type { ListingCopy, ListingStatus } from "@/types";

// Give up polling after this long in 'processing' (pipeline likely died).
const STALL_MS = 6 * 60 * 1000; // 6 minutes

interface StatusResponse {
  status: ListingStatus;
  product_name: string | null;
  original_image_url: string | null;
  images: Partial<Record<"white_bg" | "lifestyle_1" | "lifestyle_2" | "lifestyle_3" | "lifestyle_4", string>>;
  copy: ListingCopy | null;
}

function computeProgress(data: StatusResponse): { pct: number; label: string } {
  if (data.status === "complete") return { pct: 100, label: "Done!" };
  if (data.status === "error") return { pct: 100, label: "Something went wrong" };

  const hasWhiteBg = Boolean(data.images.white_bg);
  const lifestyleCount = [
    "lifestyle_1",
    "lifestyle_2",
    "lifestyle_3",
    "lifestyle_4",
  ].filter((t) => data.images[t as keyof StatusResponse["images"]]).length;
  const hasCopy = Boolean(data.copy);

  let pct = 5;
  let label = "Removing background...";

  if (hasWhiteBg) {
    pct = 25 + lifestyleCount * 15;
    label =
      lifestyleCount < 4
        ? "Generating lifestyle shots..."
        : "Writing copy...";
  }
  if (hasCopy) {
    pct = 95;
    label = "Finishing up...";
  }
  return { pct, label };
}

export default function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stop polling if generation appears stuck (e.g. the serverless function was
  // killed mid-pipeline and the listing never leaves 'processing').
  const startedAt = useRef(Date.now());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/status/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load listing");
      setData(json);
      if (json.status === "complete" || json.status === "error") {
        if (timer.current) clearInterval(timer.current);
      } else if (Date.now() - startedAt.current > STALL_MS) {
        if (timer.current) clearInterval(timer.current);
        setError(
          "This is taking longer than expected. Your results may still finish — refresh in a few minutes. If nothing appears, the generation likely failed."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listing");
      if (timer.current) clearInterval(timer.current);
    }
  }, [id]);

  useEffect(() => {
    fetchStatus();
    timer.current = setInterval(fetchStatus, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [fetchStatus]);

  const isDone = data?.status === "complete";
  const isError = data?.status === "error";
  const progress = data ? computeProgress(data) : { pct: 5, label: "Loading..." };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-bold text-navy">
            Listing<span className="text-indigo">Lab</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-navy">
            {data?.product_name || "Your listing"}
          </h1>
          {isDone && <ExportButton listingId={id} />}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Progress */}
        {!isDone && !isError && (
          <Card className="mt-6">
            <div className="flex items-center justify-between">
              <p className="font-medium text-navy">{progress.label}</p>
              <p className="text-sm text-slate-400">{Math.round(progress.pct)}%</p>
            </div>
            <div className="mt-3">
              <ProgressBar value={progress.pct} />
            </div>
            <p className="mt-3 text-sm text-slate-400">
              This can take a couple of minutes. The page updates automatically.
            </p>
          </Card>
        )}

        {isError && (
          <Card className="mt-6">
            <p className="font-medium text-red-600">Generation failed.</p>
            <p className="mt-1 text-sm text-slate-500">
              Some steps could not be completed. Any partial results are shown below.
            </p>
          </Card>
        )}

        {/* Results */}
        {data && (isDone || isError) && (
          <>
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-navy">Images</h2>
              <ImageGallery images={data.images} />
            </section>

            {data.copy && (
              <section className="mt-8">
                <CopyEditor listingId={id} copy={data.copy} />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
