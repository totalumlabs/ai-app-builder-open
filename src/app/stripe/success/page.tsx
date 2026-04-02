"use client";

/**
 * Stripe Success Page
 *
 * This page is shown after a successful payment/subscription.
 * The session_id is available in the URL query parameters.
 */

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4 text-gray-900">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your purchase. Your payment has been processed successfully.
        </p>

        {sessionId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Session ID:</p>
            <p className="text-xs font-mono break-all text-gray-700">{sessionId}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/">Return to Home</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/stripe/demo">View More Products</Link>
          </Button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Redirecting to home in {countdown} seconds...
        </p>
      </div>
    </div>
  );
}

export default function StripeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
