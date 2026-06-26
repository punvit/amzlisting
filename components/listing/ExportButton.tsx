"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function ExportButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/${listingId}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "listing.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleExport} loading={loading}>
      {loading ? "Preparing ZIP..." : "Export ZIP"}
    </Button>
  );
}
