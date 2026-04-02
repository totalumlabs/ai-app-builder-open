/**
 * Stripe Integration TypeScript Interfaces
 *
 * These interfaces define the data structures for Stripe entities
 * used throughout the application.
 *
 * Note: Products and prices are managed in code (src/lib/stripe.ts),
 * not in the database. Only customer, subscription, and payment data
 * can be optionally stored in your database.
 */

export interface StripeCustomer {
  _id: string;
  stripe_customer_id: string;
  email: string;
  name?: string;
  user_id?: string;
  stripe_data?: string; // JSON stringified Stripe customer object
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeSubscription {
  _id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string; // Stripe price ID (not database reference)
  status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete";
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: "yes" | "no";
  stripe_data?: string; // JSON stringified Stripe subscription object
  createdAt: Date;
  updatedAt: Date;
}

export interface StripePayment {
  _id: string;
  stripe_payment_intent_id: string;
  stripe_customer_id?: string;
  amount: number; // Amount in cents
  currency: string;
  status: "succeeded" | "pending" | "failed" | "canceled";
  payment_method_saved: "yes" | "no";
  stripe_data?: string; // JSON stringified Stripe payment intent object
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Demo Product Configuration
 * These are default products/prices that will be created in Stripe
 * when the user provides their API key
 */
export interface StripeProduct {
  name: string;
  description: string;
  type: "one_time" | "subscription";
  prices: StripePrice[];
}

export interface StripePrice {
  amount: number; // Amount in cents
  currency: string;
  interval?: "day" | "week" | "month" | "year";
  nickname?: string;
}

/**
 * API Request/Response Types
 */
export interface CreateCheckoutSessionRequest {
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  savePaymentMethod?: boolean;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionResponse {
  ok: boolean;
  data?: { sessionId: string; url: string };
  error?: string;
}

export interface CreateCustomerPortalRequest {
  customerId: string;
  returnUrl: string;
}

export interface CreateCustomerPortalResponse {
  ok: boolean;
  data?: { url: string };
  error?: string;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: any;
  };
}
