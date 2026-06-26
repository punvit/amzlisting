"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import type { ListingCopy } from "@/types";

type SaveState = "idle" | "saving" | "saved" | "error";

type EditableFields = {
  title: string;
  bullet_1: string;
  bullet_2: string;
  bullet_3: string;
  bullet_4: string;
  bullet_5: string;
  description: string;
  search_terms: string;
};

function toFields(copy: ListingCopy): EditableFields {
  return {
    title: copy.title ?? "",
    bullet_1: copy.bullet_1 ?? "",
    bullet_2: copy.bullet_2 ?? "",
    bullet_3: copy.bullet_3 ?? "",
    bullet_4: copy.bullet_4 ?? "",
    bullet_5: copy.bullet_5 ?? "",
    description: copy.description ?? "",
    search_terms: copy.search_terms ?? "",
  };
}

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/30";

export default function CopyEditor({
  listingId,
  copy,
}: {
  listingId: string;
  copy: ListingCopy;
}) {
  const [fields, setFields] = useState<EditableFields>(toFields(copy));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (patch: Partial<EditableFields>) => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/copy", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId, patch }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [listingId]
  );

  // Debounced auto-save whenever fields change.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(fields), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function update(key: keyof EditableFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
      ? "All changes saved"
      : saveState === "error"
      ? "Couldn't save"
      : "";

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Copy</h2>
        <span
          className={`text-xs ${
            saveState === "error" ? "text-red-600" : "text-slate-400"
          }`}
        >
          {saveLabel}
        </span>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">Title</label>
        <input
          className={fieldClass}
          value={fields.title}
          onChange={(e) => update("title", e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">{fields.title.length} / 200 chars</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">Bullets</label>
        <div className="space-y-2">
          {(["bullet_1", "bullet_2", "bullet_3", "bullet_4", "bullet_5"] as const).map(
            (key, i) => (
              <input
                key={key}
                className={fieldClass}
                placeholder={`Bullet ${i + 1}`}
                value={fields[key]}
                onChange={(e) => update(key, e.target.value)}
              />
            )
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">
          Description
        </label>
        <textarea
          className={`${fieldClass} min-h-[120px] resize-y`}
          value={fields.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy">
          Backend search terms
        </label>
        <textarea
          className={`${fieldClass} min-h-[70px] resize-y`}
          value={fields.search_terms}
          onChange={(e) => update("search_terms", e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          {new Blob([fields.search_terms]).size} / 250 bytes
        </p>
      </div>
    </Card>
  );
}
