/**
 * Stripe Webhook Handler API Route
 *
 * This endpoint handles Stripe webhook events for real-time updates on:
 * - Customer creation/updates
 * - Subscription lifecycle (created, updated, deleted)
 * - Payment intents (succeeded, failed)
 * - Invoices
 *
 * Events to subscribe to:
 * - customer.created, customer.updated, customer.deleted
 * - customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
 * - payment_intent.succeeded, payment_intent.payment_failed
 * - invoice.paid, invoice.payment_failed
 */

import { NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET, cryptoProvider } from "@/lib/stripe";
import Stripe from "stripe";
import { totalumSdk } from "@/lib/totalum";

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log("Customer created:", customer.id);
  // TODO: implement any database operations using TotalumSDK if needed
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  console.log("Customer updated:", customer.id);
  // TODO: implement any database operations using TotalumSDK if needed
}

async function handleCustomerDeleted(customer: Stripe.Customer) {
  console.log("Customer deleted:", customer.id);
  // TODO: implement any database operations using TotalumSDK if needed
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log("Subscription created:", subscription.id);
  // TODO: implement any database operations using TotalumSDK if needed
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id);
  // TODO: Update subscription in your database using TotalumSDK
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id);
  // TODO: implement any database operations using TotalumSDK if needed
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment intent succeeded:", paymentIntent.id);
  // TODO: Store payment in your database using TotalumSDK
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment intent failed:", paymentIntent.id);
  // TODO: Store failed payment in your database using TotalumSDK
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log("Invoice paid:", invoice.id);
  // TODO: Update invoice status in your database
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("Invoice payment failed:", invoice.id);
  // TODO: Handle failed invoice payment
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    // Verify webhook signature using async method for Cloudflare Workers compatibility
    if (STRIPE_WEBHOOK_SECRET) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          STRIPE_WEBHOOK_SECRET,
          undefined,
          cryptoProvider
        );
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return NextResponse.json(
          { error: `Webhook signature verification failed: ${err.message}` },
          { status: 400 }
        );
      }
    } else {
      // For development without webhook secret
      console.warn("⚠️  Webhook signature verification skipped (no STRIPE_WEBHOOK_SECRET)");
      event = JSON.parse(body) as Stripe.Event;
    }

    // Handle the event
    switch (event.type) {
      case "customer.created":
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      case "customer.updated":
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      case "customer.deleted":
        await handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[WEBHOOK ERROR]", err);
    return NextResponse.json(
      { error: err.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
