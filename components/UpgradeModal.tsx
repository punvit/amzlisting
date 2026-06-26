"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { PAID_PLANS, type PaidPlan } from "@/lib/plans";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradeModal({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpgrade(plan: PaidPlan) {
    setError(null);
    setMessage(null);
    setLoading(plan);

    try {
      const ok = await loadCheckoutScript();
      if (!ok) throw new Error("Could not load the payment window");

      const res = await fetch("/api/razorpay/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");

      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "ListingLab",
        description: `${PAID_PLANS[plan].name} plan`,
        theme: { color: "#6366F1" },
        handler: () => {
          setMessage(
            "Payment received! Your credits will update in a few seconds."
          );
          setTimeout(() => {
            router.refresh();
            onClose();
          }, 4000);
        },
      });
      rzp.on("payment.failed", () => setError("Payment failed. Please try again."));
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upgrade your plan">
      {reason && <p className="mb-4 text-sm text-slate-500">{reason}</p>}

      <div className="space-y-3">
        {(Object.keys(PAID_PLANS) as PaidPlan[]).map((plan) => {
          const p = PAID_PLANS[plan];
          return (
            <div
              key={plan}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <p className="font-semibold text-navy">{p.name}</p>
                <p className="text-sm text-slate-500">
                  ₹{p.price}/month · {p.credits} credits
                </p>
              </div>
              <Button
                onClick={() => handleUpgrade(plan)}
                loading={loading === plan}
                size="sm"
              >
                Choose
              </Button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}
    </Modal>
  );
}
