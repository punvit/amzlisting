// POST /api/webhooks/razorpay
// Razorpay calls this on subscription events. We verify the signature, then on a
// successful charge/activation we set the user's plan and reset their credits.
//
// Configure in Razorpay Dashboard -> Settings -> Webhooks:
//   URL: https://<your-domain>/api/webhooks/razorpay
//   Secret: must match RAZORPAY_WEBHOOK_SECRET
//   Events: subscription.charged, subscription.activated

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { PLAN_CREDITS, type Plan } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  // Verify the signature against the raw body.
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type = event?.event as string;

  if (type === "subscription.charged" || type === "subscription.activated") {
    const subscription = event?.payload?.subscription?.entity;
    const notes = subscription?.notes || {};
    const userId = notes.user_id as string | undefined;
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
  }

  // Always 200 for handled/ignored events so Razorpay doesn't retry forever.
  return NextResponse.json({ received: true });
}
