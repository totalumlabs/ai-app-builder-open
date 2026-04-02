/**
 * List Stripe Products and Prices API Route
 *
 * This endpoint fetches all active products and their prices from Stripe.
 * If no products exist, it automatically creates the products defined in
 * PRODUCTS_AVAILABLE (src/lib/stripe.ts).
 *
 * Usage:
 * GET /api/stripe/products
 *
 * Returns:
 * - List of products with their prices
 */

import { NextResponse } from "next/server";
import { stripe, createProductsInStripe } from "@/lib/stripe";

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

export async function GET(req: Request) {
  try {
    // Fetch all active products
    let products = await stripe.products.list({
      active: true,
      expand: ["data.default_price"],
    });

    // If no products exist, create them automatically
    if (products.data.length === 0) {
      console.log("No products found in Stripe. Creating products from PRODUCTS_AVAILABLE...");
      await createProductsInStripe();

      // Fetch products again after creation
      products = await stripe.products.list({
        active: true,
        expand: ["data.default_price"],
      });
    }

    // Fetch all active prices
    const prices = await stripe.prices.list({
      active: true,
    });

    // Group prices by product
    const pricesByProduct: Record<string, any[]> = {};
    prices.data.forEach((price) => {
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      if (!pricesByProduct[productId]) {
        pricesByProduct[productId] = [];
      }
      pricesByProduct[productId].push({
        id: price.id,
        amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval || null,
        intervalCount: price.recurring?.interval_count || null,
        nickname: price.nickname,
      });
    });

    // Format response
    const formattedProducts = products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      images: product.images,
      metadata: product.metadata,
      prices: pricesByProduct[product.id] || [],
    }));

    return NextResponse.json({
      ok: true,
      data: formattedProducts,
    });
  } catch (err) {
    console.error("[API ERROR] /api/stripe/products", err);
    return NextResponse.json(
      { ok: false, error: serializeError(err) },
      { status: 500 }
    );
  }
}
