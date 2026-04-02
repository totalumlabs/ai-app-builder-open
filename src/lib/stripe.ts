/**
 * Stripe Configuration and Utilities
 *
 * This file initializes the Stripe client and provides demo products/prices
 * that will be automatically created in Stripe when the API key is provided.
 */

import Stripe from "stripe";
import { StripeProduct } from "@/types/stripe";

// Get Stripe secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

// Lazy initialization to avoid build-time errors when API key is not set
let stripeInstance: Stripe | null = null;

/**
 * Get Stripe client instance
 * Initializes Stripe client on first use
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!stripeSecretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set in environment variables. " +
        "Add your Stripe secret key to .env to enable Stripe integration."
      );
    }
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: "2025-09-30.clover",
      typescript: true,
      // Use Fetch HTTP client for Cloudflare Workers compatibility
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return stripeInstance;
}

// For backward compatibility and convenience
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return (getStripe() as any)[prop];
  }
});

/**
 * SubtleCryptoProvider for webhook signature verification
 * Required for Cloudflare Workers since WebCrypto is async
 */
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Available Products Configuration
 *
 * Define your products here. These will be created in Stripe automatically
 * when accessed. This allows you to manage products in code and deploy changes
 * easily without database migrations.
 */
export const PRODUCTS_AVAILABLE: StripeProduct[] = [
  {
    name: "Premium E-Book",
    description: "This is a demo one-time purchase product",
    type: "one_time",
    prices: [
      {
        amount: 2999, // $29.99
        currency: "usd",
        nickname: "One-time purchase",
      },
    ],
  },
  {
    name: "Pro Plan",
    description: "Full access to all premium features",
    type: "subscription",
    prices: [
      {
        amount: 999, // $9.99/month
        currency: "usd",
        interval: "month",
        nickname: "Monthly",
      },
      {
        amount: 9999, // $99.99/year (saves ~17%)
        currency: "usd",
        interval: "year",
        nickname: "Yearly (Save 17%)",
      },
    ],
  },
  {
    name: "Business Plan",
    description: "Advanced features for teams and businesses",
    type: "subscription",
    prices: [
      {
        amount: 2999, // $29.99/month
        currency: "usd",
        interval: "month",
        nickname: "Monthly",
      },
      {
        amount: 29999, // $299.99/year (saves ~17%)
        currency: "usd",
        interval: "year",
        nickname: "Yearly (Save 17%)",
      },
    ],
  },
];

/**
 * Helper function to format amount in cents to dollars
 */
export function formatAmount(amount: number, currency: string = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Helper function to create products in Stripe
 * Creates all products defined in PRODUCTS_AVAILABLE
 */
export async function createProductsInStripe() {
  const createdProducts: Array<{
    product: Stripe.Product;
    prices: Stripe.Price[];
  }> = [];

  for (const product of PRODUCTS_AVAILABLE) {
    try {
      // Create product in Stripe
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description,
        metadata: {
          type: product.type,
        },
      });

      const prices: Stripe.Price[] = [];

      // Create prices for this product
      for (const price of product.prices) {
        const priceData: Stripe.PriceCreateParams = {
          product: stripeProduct.id,
          unit_amount: price.amount,
          currency: price.currency,
          nickname: price.nickname,
        };

        // Add recurring data for subscription prices
        if (price.interval) {
          priceData.recurring = {
            interval: price.interval,
          };
        }

        const createdPrice = await stripe.prices.create(priceData);
        prices.push(createdPrice);
      }

      createdProducts.push({ product: stripeProduct, prices });
    } catch (error) {
      console.error(`Error creating product ${product.name}:`, error);
      throw error;
    }
  }

  return createdProducts;
}

/**
 * Get Stripe webhook signing secret
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

if (!STRIPE_WEBHOOK_SECRET && stripeSecretKey) {
  console.warn(
    "⚠️  STRIPE_WEBHOOK_SECRET is not set. " +
    "Webhook signature verification will be skipped. " +
    "Add STRIPE_WEBHOOK_SECRET to .env for production."
  );
}

/**
 * Get the public-facing app URL
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
