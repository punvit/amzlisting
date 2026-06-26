"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import UpgradeModal from "@/components/UpgradeModal";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MIN_DIMENSION = 500; // px
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

type Step = "upload" | "confirm";

interface Detected {
  detected_name: string;
  suggested_category: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = dataUrl;
  });
}

export default function NewListingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [keywords, setKeywords] = useState("");

  const [detected, setDetected] = useState<Detected | null>(null);
  const [confirmedName, setConfirmedName] = useState("");
  const [confirmedCategory, setConfirmedCategory] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");

  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPG or PNG image.");
      setImageDataUrl(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Maximum size is 10MB.");
      setImageDataUrl(null);
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const { width, height } = await getImageDimensions(dataUrl);
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      setError(
        `Image is too small (${width}x${height}px). Minimum is ${MIN_DIMENSION}px on each side.`
      );
      setImageDataUrl(null);
      return;
    }

    setImageDataUrl(dataUrl);
  }

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!imageDataUrl) {
      setError("Please upload a product image.");
      return;
    }
    if (!productName.trim()) {
      setError("Please enter a product name.");
      return;
    }

    setDetecting(true);
    try {
      const res = await fetch("/api/detect-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed");

      setDetected(data);
      setConfirmedName(data.detected_name || productName);
      setConfirmedCategory(data.suggested_category || "");
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          productName: confirmedName,
          category: confirmedCategory,
          keywords,
          gender,
        }),
      });
      const data = await res.json();
      if (res.status === 402 || data.code === "no_credits") {
        setShowUpgrade(true);
        setGenerating(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not start generation");
      router.push(`/listing/${data.listingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start generation");
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-bold text-navy">
            Listing<span className="text-indigo">Lab</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-bold text-navy">New Listing</h1>
        <p className="mt-1 text-sm text-slate-500">
          {step === "upload"
            ? "Upload a product photo and we'll identify it."
            : "Confirm the detected product before generating."}
        </p>

        {step === "upload" && (
          <form onSubmit={handleDetect} className="mt-6 space-y-5">
            <Card>
              <label className="mb-1.5 block text-sm font-medium text-navy">
                Product image (JPG/PNG, max 10MB, min 500px)
              </label>

              {imageDataUrl ? (
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDataUrl}
                    alt="Product preview"
                    className="max-h-64 rounded-lg object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-3 text-sm font-medium text-indigo hover:underline"
                  >
                    Choose a different image
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 py-12 text-center hover:border-indigo"
                >
                  <p className="text-sm font-medium text-navy">Click to upload</p>
                  <p className="mt-1 text-xs text-slate-400">JPG or PNG</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                className="hidden"
              />
            </Card>

            <Card className="space-y-4">
              <Input
                label="Product name"
                name="productName"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Stainless Steel Water Bottle"
              />
              <Input
                label="Target keywords (optional)"
                name="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. insulated, leak-proof, gym"
              />
            </Card>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button type="submit" loading={detecting} className="w-full">
              {detecting ? "Detecting product..." : "Continue"}
            </Button>
          </form>
        )}

        {step === "confirm" && detected && (
          <div className="mt-6 space-y-5">
            <Card>
              {imageDataUrl && (
                <div className="mb-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDataUrl}
                    alt="Product preview"
                    className="max-h-56 rounded-lg object-contain"
                  />
                </div>
              )}
              <p className="text-sm text-slate-500">
                We detected this product. Edit if needed, then generate.
              </p>
              <div className="mt-4 space-y-4">
                <Input
                  label="Product name"
                  value={confirmedName}
                  onChange={(e) => setConfirmedName(e.target.value)}
                />
                <Input
                  label="Category"
                  value={confirmedCategory}
                  onChange={(e) => setConfirmedCategory(e.target.value)}
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-navy">
                    Lifestyle style
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["female", "male"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`h-11 rounded-xl border text-sm font-medium capitalize transition-colors ${
                          gender === g
                            ? "border-indigo bg-indigo text-white"
                            : "border-slate-300 bg-white text-navy hover:border-indigo"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Picks 3 lifestyle scenes from the {gender} prompt set.
                  </p>
                </div>
              </div>
            </Card>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("upload");
                  setError(null);
                }}
                disabled={generating}
              >
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                loading={generating}
                className="flex-1"
              >
                {generating ? "Starting..." : "Generate (1 credit)"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="You're out of credits. Upgrade to keep generating listings."
      />
    </main>
  );
}
