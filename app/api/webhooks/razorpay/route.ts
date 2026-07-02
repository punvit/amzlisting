// POST /api/webhooks/razorpay
// Razorpay calls this on subscription events. We verify the signature, then:
//   - subscription.charged / subscription.activated -> set plan + reset credits
//   - subscription.cancelled / halted / paused / expired -> downgrade to free
//     (remaining credits capped at the free allowance)
//
// Configure in Razorpay Dashboard -> Settings -> Webhooks:
//   URL: https://<your-domain>/api/webhooks/razorpay
//   Secret: must match RAZORPAY_WEBHOOK_SECRET
//   Events: subscription.charged, subscription.activated,
//           subscription.cancelled, subscription.halted,
//           subscription.paused, subscription.expired

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { PLAN_CREDITS, type Plan } from "@/lib/plans";

const UPGRADE_EVENTS = ["subscription.charged", "subscription.activated"];
const DOWNGRADE_EVENTS = [
  "subscription.cancelled",
  "subscription.halted",
  "subscription.paused",
  "subscription.expired",
];

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  // Verify the signature against the raw body (constant-time comparison).
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let valid = false;
  try {
    const provided = Buffer.from(signature, "hex");
    valid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type = event?.event as string;
  const subscription = event?.payload?.subscription?.entity;
  const notes = subscription?.notes || {};
  const userId = notes.user_id as string | undefined;

  if (UPGRADE_EVENTS.includes(type)) {
    const plan = notes.plan as Plan | undefined;

    if (userId && plan && plan in PLAN_CREDITS) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("profiles")
        .update({ plan, credits_remaining: PLAN_CREDITS[plan] })
        .eq("id", userId);
      if (error) {
        console.error("webhook profile update failed:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
    }
  } else if (DOWNGRADE_EVENTS.includes(type)) {
    if (userId) {
      const admin = createSupabaseAdminClient();
      // Back to free; keep remaining credits but cap them at the free allowance.
      const { data: profile } = await admin
        .from("profiles")
        .select("credits_remaining")
        .eq("id", userId)
        .single();
      const capped = Math.min(
        profile?.credits_remaining ?? 0,
        PLAN_CREDITS.free
      );
      const { error } = await admin
        .from("profiles")
        .update({ plan: "free", credits_remaining: capped })
        .eq("id", userId);
      if (error) {
        console.error("webhook downgrade failed:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
    }
  }

  // Always 200 for handled/ignored events so Razorpay doesn't retry forever.
  return NextResponse.json({ received: true });
}
