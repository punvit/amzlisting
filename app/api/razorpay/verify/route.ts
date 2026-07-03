// POST /api/razorpay/verify
// Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
//
// Called by the checkout modal right after a successful payment. Verifies the
// Razorpay signature (HMAC-SHA256, constant-time compare) and activates the
// plan immediately so the user doesn't have to wait for the webhook. The
// webhook remains the source of truth for renewals/cancellations.
//
// For subscriptions the signature is:
//   HMAC_SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, KEY_SECRET)
//
// The plan is NEVER taken from the client — we fetch the subscription from
// Razorpay and read the notes we set at creation time (user_id, plan).

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { getRazorpay } from "@/lib/razorpay";
import { PLAN_CREDITS, type Plan } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = body;
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("RAZORPAY_KEY_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // --- Verify signature (constant-time) ---
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest();
  let valid = false;
  try {
    const provided = Buffer.from(razorpay_signature, "hex");
    valid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // --- Fetch the subscription from Razorpay; trust its notes, not the client ---
  try {
    const razorpay = getRazorpay();
    const subscription = (await razorpay.subscriptions.fetch(
      razorpay_subscription_id
    )) as { notes?: Record<string, string> };

    const notes = subscription?.notes || {};
    const plan = notes.plan as Plan | undefined;

    if (notes.user_id !== user.id) {
      return NextResponse.json({ error: "Subscription mismatch" }, { status: 403 });
    }
    if (!plan || !(plan in PLAN_CREDITS)) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ plan, credits_remaining: PLAN_CREDITS[plan] })
      .eq("id", user.id);
    if (error) {
      console.error("verify: profile update failed:", error);
      return NextResponse.json({ error: "Could not activate plan" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan, credits: PLAN_CREDITS[plan] });
  } catch (err) {
    console.error("verify: razorpay fetch failed:", err);
    return NextResponse.json(
      { error: "Could not verify payment" },
      { status: 500 }
    );
  }
}
