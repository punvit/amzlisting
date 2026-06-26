"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import UpgradeModal from "@/components/UpgradeModal";

export default function UpgradeButton({
  outOfCredits = false,
}: {
  outOfCredits?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={outOfCredits ? "primary" : "secondary"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        Upgrade
      </Button>
      <UpgradeModal
        open={open}
        onClose={() => setOpen(false)}
        reason={
          outOfCredits
            ? "You're out of credits. Upgrade to keep generating listings."
            : undefined
        }
      />
    </>
  );
}
