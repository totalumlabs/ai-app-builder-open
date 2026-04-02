/**
 * Create Stripe Customer Portal Session API Route
 *
 * This endpoint creates a Stripe Customer Portal session which allows customers to:
 * - View and download invoices
 * - Update payment methods
 * - Manage subscriptions (cancel, upgrade, etc.)
 *
 * Usage:
 * POST /api/stripe/customer-portal
 * Body: {
 *   customerId: string,
 *   returnUrl?: string
 * }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, APP_URL } from "@/lib/stripe";

function serializeError(err: unknown) {
  const e = err as any;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
    status: e?.response?.status ?? null,
    responseData: e?.response?.data ?? null,
  };
}

const schema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  returnUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { customerId, returnUrl } = parsed.data;

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${APP_URL}/account`,
    });

    return NextResponse.json({
      ok: true,
      data: { url: session.url },
    });
  } catch (err) {
    console.error("[API ERROR] /api/stripe/customer-portal", err);
    return NextResponse.json(
      { ok: false, error: serializeError(err) },
      { status: 500 }
    );
  }
}
