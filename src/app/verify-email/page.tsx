"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [status, setStatus] = useState<"success" | "error" | "loading">("loading");

  useEffect(() => {
    setStatus(error ? "error" : "success");
  }, [error]);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fcfbf8" }}>
      <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#fcfbf8" }}>
      <Card className="w-full max-w-md shadow-xl border bg-white/90 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          {status === "error" ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Verification failed</CardTitle>
              <CardDescription className="text-base">The link may have expired or is invalid. Please try again.</CardDescription>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Email verified!</CardTitle>
              <CardDescription className="text-base">Your email has been verified. You can now sign in.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardFooter className="pt-2">
          <Link href="/login" className="w-full">
            <Button className="w-full h-11 text-base font-semibold bg-gray-900 hover:bg-gray-800">
              {status === "error" ? "Try again" : "Sign in"}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fcfbf8" }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
