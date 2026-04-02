/**
 * Create Stripe Checkout Session API Route
 *
 * This endpoint creates a Stripe Checkout Session for both:
 * - One-time payments (with optional payment method saving)
 * - Subscription payments
 *
 * Usage:
 * POST /api/stripe/create-checkout-session
 * Body: {
 *   priceId: string,
 *   mode: "payment" | "subscription",
 *   savePaymentMethod?: boolean,
 *   customerEmail?: string
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
  priceId: z.string().min(1, "Price ID is required"),
  mode: z.enum(["payment", "subscription"]),
  savePaymentMethod: z.boolean().optional().default(false),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
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

    const { priceId, mode, savePaymentMethod, customerEmail, metadata } = parsed.data;

    // Build checkout session parameters
    const sessionParams: any = {
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/stripe/cancel`,
      metadata: metadata || {},
    };

    // Add customer email if provided
    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    // For payment mode with savePaymentMethod option
    if (mode === "payment") {
      if (savePaymentMethod) {
        sessionParams.payment_intent_data = {
          setup_future_usage: "off_session",
        };
      }
    }

    // For subscription mode, always save payment method
    if (mode === "subscription") {
      sessionParams.payment_method_collection = "always";
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      ok: true,
      data: { sessionId: session.id, url: session.url },
    });
  } catch (err) {
    console.error("[API ERROR] /api/stripe/create-checkout-session", err);
    return NextResponse.json(
      { ok: false, error: serializeError(err) },
      { status: 500 }
    );
  }
}
