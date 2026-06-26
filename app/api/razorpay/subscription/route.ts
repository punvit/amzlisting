// POST /api/razorpay/subscription
// Body: { plan: "starter" | "pro" }
// Creates a Razorpay subscription and returns its id for Checkout.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getRazorpay } from "@/lib/razorpay";
import { PAID_PLANS, type PaidPlan } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let plan: PaidPlan;
  try {
    const body = await request.json();
    plan = body.plan;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!(plan in PAID_PLANS)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const planId = process.env[PAID_PLANS[plan].planIdEnv];
  if (!planId) {
    return NextResponse.json(
      { error: `Plan not configured (${PAID_PLANS[plan].planIdEnv} missing)` },
      { status: 500 }
    );
  }

  try {
    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12, // bill monthly for up to a year
      customer_notify: 1,
      notes: { user_id: user.id, plan },
    } as any);

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
    });
  } catch (err) {
    console.error("razorpay subscription error:", err);
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}
