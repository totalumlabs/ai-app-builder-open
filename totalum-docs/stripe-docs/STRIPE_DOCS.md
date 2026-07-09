# Stripe Integration Setup Guide

Complete step-by-step guide to set up Stripe payments in your Next.js application.

The current implementation is to use the stripe redirect page for checkout, and stripe webhooks for handle the payment events. So we don't need to handle sensitive data and we don't need to create custom payment forms and frontend logic for handle the payments.

---

## 📋 Mandatory Prerequisites

Ask user for provide a valid Stripe private api key before start. If user doesn't provide one, return feedback message "Please provide a valid Stripe private API key to proceed with the setup." 

SUPER IMPORTANT MANDATORY: Never start the stripe setup without a valid Stripe private API key on .env file.

When user provide a valid Stripe private API key:

Add API Key that user provides to .env File with the key name `STRIPE_SECRET_KEY`

SUPER IMPORTANT MANDATORY: You must add a visual page for user can see the products/subscriptions available for purchase. And manage their payment methods/subscriptions (redirect to stripe page managed billing). This page must be accessible from the existing pages.

---

## 🚀 Setup

SUPER MANDATORY: Never start the stripe setup without a valid Stripe private API key on .env file.

### Step 1: Webhook Setup

Webhooks allow Stripe to notify your application about events (successful payments, subscription updates, etc.) in real-time.

### Automatic Webhook Setup

**IMPORTANT:** Run this AFTER adding your `STRIPE_SECRET_KEY` to `.env`

```bash
npm run setup:stripe-webhook
```

**What this script does:**
- ✅ Creates a webhook endpoint in your Stripe account
- ✅ Configures all necessary webhook events automatically
- ✅ Retrieves the webhook signing secret
- ✅ Saves `STRIPE_WEBHOOK_SECRET` to your `.env` file


### Step 2: Database Setup

**By default, the integration works WITHOUT a database!** Stripe webhooks currently just log events to the console.

**But most of the time is mandatory to modify/store something on the database when a user purchase a product or a subscription. Like the current plan status, etc.**
In that case use Totalum mcp for create the necessary fields  to existing tables or create new tables for store the necessary data. Try to avoid to create new tables if not strictly necessary. Is better to add only the minimum necessary fields to existing tables.


### Enable Database Storage in Webhooks

After creating the tables, you need to uncomment the database code in the webhook handler:

1. Open `src/app/api/stripe/webhook/route.ts`
2. Implement all the necessary totalumSdk operations for modify database as needed


## 🎨 Customizing Products

Products are defined in `src/lib/stripe.ts` in the `PRODUCTS_AVAILABLE` array.

### Add a New Product

Edit `src/lib/stripe.ts`:

```typescript
export const PRODUCTS_AVAILABLE: StripeProduct[] = [
  // Existing products...

  // Add your new product:
  {
    name: "Enterprise Plan",
    description: "Full-featured enterprise solution with priority support",
    type: "subscription", // or "one_time"
    prices: [
      {
        amount: 9999, // $99.99/month
        currency: "usd",
        interval: "month",
        nickname: "Monthly",
      },
      {
        amount: 99999, // $999.99/year (saves ~17%)
        currency: "usd",
        interval: "year",
        nickname: "Yearly (Save 17%)",
      },
    ],
  },
];
```

**Product Type:**
- `"one_time"` - Single payment (e.g., ebooks, courses, one-time services)
- `"subscription"` - Recurring payment (e.g., monthly/yearly plans)

**Price Fields:**
- `amount` - Price in cents (2999 = $29.99)
- `currency` - Currency code (usd, eur, gbp, etc.)
- `interval` - For subscriptions only: "month", "year", "week", "day"
- `nickname` - Display name for the price

**After editing:**
1. Delete existing products in Stripe Dashboard (https://dashboard.stripe.com/test/products)
2. Reload http://localhost:3000/stripe/demo
3. New products will be automatically created!

---

## 🔍 Testing Webhooks Locally (Optional)

Important: ONLY execute this test if the user says specifically that the webhooks events doesn't work.

For advanced testing, you can use Stripe CLI to trigger webhook events locally:

### Install Stripe CLI

```bash
# Linux
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe
```

### Forward Webhooks to Localhost

```bash
# In a separate terminal window:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will give you a webhook signing secret that you can add to `.env` for local testing.

### Trigger Test Events

```bash
# Trigger successful payment
stripe trigger payment_intent.succeeded

# Trigger subscription created
stripe trigger customer.subscription.created

# Trigger subscription updated
stripe trigger customer.subscription.updated

# Trigger payment failed
stripe trigger payment_intent.payment_failed
```

Check your server logs to see the webhook events being processed!

---
