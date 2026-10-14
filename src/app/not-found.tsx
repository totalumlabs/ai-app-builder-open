import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.42em] text-[#00DFFF] mb-4">404</p>
        <h1 className="font-display text-6xl font-extrabold text-white tracking-tight">SIGNAL LOST</h1>
        <h2 className="mt-3 text-lg font-medium text-[#94A3B8]">
          Page not found
        </h2>
        <p className="mt-4 text-[#94A3B8] max-w-md mx-auto">
          That route does not exist. Return to RyanFenn.ai and describe what you want to build.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button>
              Go back home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
