// Plan configuration (Phase 1).

export type Plan = "free" | "starter" | "pro" | "business";
export type PaidPlan = "starter" | "pro" | "business";

export const PLAN_CREDITS: Record<Plan, number> = {
  free: 3,
  starter: 50,
  pro: 100,
  business: 500,
};

export const PAID_PLANS: Record<
  PaidPlan,
  { name: string; price: number; credits: number; planIdEnv: string }
> = {
  starter: {
    name: "Starter",
    price: 1499, // INR / month
    credits: 50,
    planIdEnv: "RAZORPAY_PLAN_STARTER",
  },
  pro: {
    name: "Pro",
    price: 2499, // INR / month
    credits: 100,
    planIdEnv: "RAZORPAY_PLAN_PRO",
  },
  business: {
    name: "Business",
    price: 9999, // INR / month
    credits: 500,
    planIdEnv: "RAZORPAY_PLAN_BUSINESS",
  },
};
