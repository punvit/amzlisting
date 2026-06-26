// Dashboard: credit balance, "New Listing" CTA, and the user's past listings.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/Badge";
import UpgradeButton from "@/components/UpgradeButton";
import type { Listing } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: listings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan, credits_remaining")
      .eq("id", user.id)
      .single(),
    supabase
      .from("listings")
      .select("id, product_name, status, created_at, original_image_url, user_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const credits = profile?.credits_remaining ?? 0;
  const plan = profile?.plan ?? "free";
  const rows = (listings ?? []) as Listing[];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-bold text-navy">
            Listing<span className="text-indigo">Lab</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Credits + CTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Card className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Credits remaining</p>
                <p className="mt-1 text-3xl font-bold text-navy">{credits}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Plan</p>
                  <p className="mt-1 font-semibold capitalize text-indigo">{plan}</p>
                </div>
                <UpgradeButton outOfCredits={credits === 0} />
              </div>
            </div>
          </Card>
          <Link href="/new" className="sm:self-stretch">
            <Button size="lg" className="h-full w-full sm:w-auto">
              + New Listing
            </Button>
          </Link>
        </div>

        {/* Listings */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-navy">Your listings</h2>

          {rows.length === 0 ? (
            <Card className="mt-4 flex flex-col items-center justify-center py-16 text-center">
              <p className="text-slate-600">You haven&apos;t created any listings yet.</p>
              <p className="mt-1 text-sm text-slate-400">
                Upload a product photo to generate images and copy.
              </p>
              <Link href="/new" className="mt-5">
                <Button>Create your first listing</Button>
              </Link>
            </Card>
          ) : (
            <div className="mt-4 space-y-3">
              {rows.map((listing) => (
                <Link key={listing.id} href={`/listing/${listing.id}`}>
                  <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                    <div>
                      <p className="font-medium text-navy">
                        {listing.product_name || "Untitled product"}
                      </p>
                      <p className="text-sm text-slate-400">
                        {formatDate(listing.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={listing.status} />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
