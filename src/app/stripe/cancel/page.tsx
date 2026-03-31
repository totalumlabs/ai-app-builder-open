"use client";

/**
 * Stripe Cancel Page
 *
 * This page is shown when a user cancels the checkout process.
 */

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function StripeCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4 text-gray-900">Checkout Canceled</h1>
        <p className="text-gray-600 mb-6">
          You have canceled the checkout process. No charges have been made.
        </p>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/stripe/demo">Try Again</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
