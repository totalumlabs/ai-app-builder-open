---
name: stripe-payments
description: "Stripe payment integration for subscriptions and one-time payments. Use when implementing checkout, subscriptions, payment webhooks, or billing management. Activates when user requests payment features, Stripe setup, or pricing pages. Requires STRIPE_SECRET_KEY."
---

# Stripe Payments Skill

Use this skill when implementing or editing Stripe payment features.

## When to Use This Skill

- Setting up Stripe payments
- Creating checkout flows
- Implementing subscriptions
- Handling payment webhooks
- Building pricing pages
- Managing customer billing

---

## Prerequisites

SUPER IMPORTANT: NEVER ASK FOR STRIPE_WEBHOOK_SECRET, ASK FOR STRIPE_SECRET_KEY, AND THEN YOU WILL CREATE THE WEBHOOK AND GET THE SIGNING SECRET YOURSELF RUNNING npm run setup:stripe-webhook

Super important, for Stripe integration only require the STRIPE_SECRET_KEY, not more.

### MANDATORY: Get API Key First
**NEVER start Stripe setup without a valid API key!**

If user hasn't provided one:
```
"Please provide a valid Stripe private API key to proceed with the setup."
```

When provided, add to `.env`:
```
STRIPE_SECRET_KEY=sk_live_xxx  # or sk_test_xxx for testing
```

---

## Setup Workflow

### Step 1: Add API Key to .env
```
STRIPE_SECRET_KEY=sk_xxx
```

### Step 2: Run Webhook Setup
```bash
npm run setup:stripe-webhook
```

This script:
- Creates webhook endpoint in Stripe
- Configures all necessary events
- Retrieves webhook signing secret
- Saves `STRIPE_WEBHOOK_SECRET` to `.env`

### Step 3: Database Setup (If Needed)

**Default behavior:** Webhooks log to console only.

**If storing payment data:**
1. Use Totalum MCP to add fields to existing tables (preferred) or create new tables
2. Update webhook handler to save to database

Example: Add to existing `user` table:
```typescript
mcp__totalum__createTableProperty({
  structureId: "user_table_id",
  property: {
    name: "stripe_customer_id",
    label: "Stripe Customer ID",
    propertyType: "string"
  }
})

mcp__totalum__createTableProperty({
  structureId: "user_table_id",
  property: {
    name: "subscription_status",
    label: "Subscription Status",
    propertyType: "options",
    typeExtras: {
      options: [
        { value: "active", color: "#22c55e" },
        { value: "canceled", color: "#ef4444" },
        { value: "past_due", color: "#f59e0b" },
        { value: "none", color: "#6b7280" }
      ]
    }
  }
})
```

### Step 4: Create Visual Pages
**MANDATORY:** Create UI for:
- Products/subscriptions available for purchase
- Managed billing (redirect to Stripe)

---

## Product Configuration

### Define Products in `src/lib/stripe.ts`

```typescript
export const PRODUCTS_AVAILABLE: StripeProduct[] = [
  // One-time payment
  {
    name: "E-Book Bundle",
    description: "Complete guide to...",
    type: "one_time",
    prices: [
      {
        amount: 2999,      // $29.99
        currency: "usd",
        nickname: "Standard"
      }
    ]
  },

  // Subscription with monthly/yearly
  {
    name: "Pro Plan",
    description: "Full access to all features",
    type: "subscription",
    prices: [
      {
        amount: 1999,      // $19.99/month
        currency: "usd",
        interval: "month",
        nickname: "Monthly"
      },
      {
        amount: 19999,     // $199.99/year (save 17%)
        currency: "usd",
        interval: "year",
        nickname: "Yearly (Save 17%)"
      }
    ]
  }
];
```

### Product Types
- `"one_time"` - Single payment (ebooks, courses, services)
- `"subscription"` - Recurring (monthly/yearly plans)

### Price Fields
- `amount` - Price in cents (2999 = $29.99)
- `currency` - Currency code (usd, eur, gbp)
- `interval` - For subscriptions: "month", "year", "week", "day"
- `nickname` - Display name for the price

### After Editing Products
1. Delete existing products in Stripe Dashboard
2. Reload the app
3. Products auto-created on first load

---

## Webhook Handler

### Location: `src/app/api/stripe/webhook/route.ts`

### Key Events to Handle:
```typescript
switch (event.type) {
  case "checkout.session.completed":
    // Payment successful
    // Save customer info, update subscription status
    break;

  case "customer.subscription.created":
    // New subscription started
    break;

  case "customer.subscription.updated":
    // Plan changed, renewed, etc.
    break;

  case "customer.subscription.deleted":
    // Subscription canceled
    break;

  case "invoice.payment_succeeded":
    // Recurring payment successful
    break;

  case "invoice.payment_failed":
    // Payment failed - notify user
    break;
}
```

### Enable Database Storage
Uncomment/implement TotalumSDK operations in webhook handler:

```typescript
import { totalumSdk } from "@/lib/totalum";

// In webhook handler:
case "checkout.session.completed": {
  const session = event.data.object;

  // Update user's subscription status
  await totalumSdk.crud.editRecordById("user", userId, {
    stripe_customer_id: session.customer,
    subscription_status: "active"
  });
  break;
}
```

---

## Checkout Flow

### Create Checkout Session API
```typescript
// src/app/api/stripe/checkout/route.ts
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { priceId, mode } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: mode, // "payment" or "subscription"
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
```

### Frontend Checkout Button
```typescript
"use client";

async function handleCheckout(priceId: string, mode: "payment" | "subscription") {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId, mode }),
  });

  const data = (await response.json()) as { url: string };
  window.location.href = data.url;
}
```

---

## Billing Portal

### Redirect to Stripe Managed Billing
```typescript
// src/app/api/stripe/portal/route.ts
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { customerId } = await req.json();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
  });

  return NextResponse.json({ url: session.url });
}
```

---

## Pricing Page Component

```typescript
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Get started for free",
    features: ["Feature 1", "Feature 2"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19.99",
    period: "/month",
    description: "For growing businesses",
    features: ["Everything in Free", "Feature 3", "Feature 4", "Priority support"],
    cta: "Start Free Trial",
    popular: true,
    priceId: "price_xxx",
  },
];

export function PricingSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center">Pricing</h2>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.popular ? "border-primary shadow-lg" : ""}>
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center py-1 text-sm">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {plan.price}
                  {plan.period && <span className="text-lg font-normal">{plan.period}</span>}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckIcon className="w-5 h-5 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => plan.priceId && handleCheckout(plan.priceId, "subscription")}
                >
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Testing Webhooks Locally

**Only if webhooks aren't working:**

### Install Stripe CLI
```bash
# Linux
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe
```

### Forward Webhooks
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Trigger Test Events
```bash
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
```

---

## Checklist

- [ ] Got STRIPE_SECRET_KEY from user
- [ ] Added key to .env
- [ ] Ran `npm run setup:stripe-webhook`
- [ ] Created pricing page UI
- [ ] Implemented checkout flow
- [ ] Added billing management (Stripe portal redirect)
- [ ] Database fields added if needed
- [ ] Webhook handler updated for database operations
