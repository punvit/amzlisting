import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Button from "@/components/ui/Button";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-navy text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full bg-indigo/20 px-3 py-1 text-sm font-medium text-indigo">
          ListingLab
        </span>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Turn one product photo into a full Amazon listing.
        </h1>
        <p className="mt-4 max-w-xl text-slate-300">
          Clean white-background shots, lifestyle images, and conversion-ready
          copy. Generated in minutes.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup">
            <Button size="lg">Get started free</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
              Log in
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">3 free listings. No card required.</p>
      </div>
    </main>
  );
}
