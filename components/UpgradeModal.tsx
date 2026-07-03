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
        modal: {
          // User closed the checkout without paying.
          ondismiss: () => setLoading(null),
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          // Verify the payment signature server-side, then activate the plan.
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Verification failed");
            }
            setMessage(
              `Payment verified! Your ${PAID_PLANS[plan].name} plan is active with ${verifyData.credits} credits.`
            );
            setTimeout(() => {
              router.refresh();
              onClose();
            }, 2500);
          } catch {
            // Payment went through but verification failed — the webhook will
            // still activate the plan within a minute or two.
            setMessage(
              "Payment received! Your plan will activate within a couple of minutes."
            );
            setTimeout(() => {
              router.refresh();
              onClose();
            }, 5000);
          }
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
