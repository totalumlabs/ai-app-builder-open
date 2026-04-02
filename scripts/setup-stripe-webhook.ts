#!/usr/bin/env ts-node
/**
 * Stripe Webhook Setup Script
 *
 * This script automatically:
 * 1. Creates a webhook endpoint in Stripe
 * 2. Retrieves the webhook signing secret
 * 3. Saves it to your .env file
 *
 * Prerequisites:
 * - STRIPE_SECRET_KEY must be set in .env
 * - NEXT_PUBLIC_APP_URL must be set in .env (or will use http://localhost:3000)
 *
 * Usage:
 * npm run setup:stripe-webhook
 */

import * as fs from "fs";
import * as path from "path";
import Stripe from "stripe";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.cyan);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

// Load environment variables from .env file
function loadEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    logError(".env file not found!");
    process.exit(1);
  }

  const envFile = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};

  envFile.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, ...valueParts] = trimmedLine.split("=");
      const value = valueParts.join("=").trim();
      if (key && value) {
        env[key.trim()] = value;
      }
    }
  });

  return env;
}

// Update .env file with webhook secret
function updateEnvFile(webhookSecret: string) {
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  // Check if STRIPE_WEBHOOK_SECRET already exists
  const webhookSecretRegex = /^STRIPE_WEBHOOK_SECRET=.*$/m;

  if (webhookSecretRegex.test(envContent)) {
    // Replace existing value
    envContent = envContent.replace(
      webhookSecretRegex,
      `STRIPE_WEBHOOK_SECRET=${webhookSecret}`
    );
    logInfo("Updated existing STRIPE_WEBHOOK_SECRET in .env");
  } else {
    // Add new line after STRIPE_SECRET_KEY
    const stripeKeyRegex = /^STRIPE_SECRET_KEY=.*$/m;
    if (stripeKeyRegex.test(envContent)) {
      envContent = envContent.replace(
        stripeKeyRegex,
        (match) => `${match}\nSTRIPE_WEBHOOK_SECRET=${webhookSecret}`
      );
    } else {
      // Append at the end if STRIPE_SECRET_KEY not found
      envContent += `\n\n# Stripe webhook signing secret\nSTRIPE_WEBHOOK_SECRET=${webhookSecret}\n`;
    }
    logInfo("Added STRIPE_WEBHOOK_SECRET to .env");
  }

  fs.writeFileSync(envPath, envContent, "utf-8");
  logSuccess("Updated .env file");
}

// Main setup function
async function setupStripeWebhook() {
  log("\n" + "=".repeat(60), colors.bright);
  log("Stripe Webhook Setup", colors.bright + colors.cyan);
  log("=".repeat(60) + "\n", colors.bright);

  // Load environment variables
  logInfo("Loading environment variables...");
  const env = loadEnv();

  // Check for STRIPE_SECRET_KEY
  const stripeSecretKey = env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || stripeSecretKey.trim() === "") {
    logError("STRIPE_SECRET_KEY is not set in .env file!");
    logError("Please add your Stripe secret key to .env and try again.");
    log("\nExample:", colors.yellow);
    log("STRIPE_SECRET_KEY=sk_test_your_key_here\n", colors.yellow);
    process.exit(1);
  }

  logSuccess("Found STRIPE_SECRET_KEY");

  // Get app URL
  const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/stripe/webhook`;

  logInfo(`Webhook URL: ${webhookUrl}`);

  // Initialize Stripe
  logInfo("Initializing Stripe...");
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-09-30.clover",
    typescript: true,
  });

  try {
    // Check if webhook endpoint already exists
    logInfo("Checking for existing webhook endpoints...");
    const existingWebhooks = await stripe.webhookEndpoints.list();

    const existingWebhook = existingWebhooks.data.find(
      (webhook) => webhook.url === webhookUrl
    );

    let webhookEndpoint: Stripe.WebhookEndpoint;

    if (existingWebhook) {
      logWarning("Webhook endpoint already exists!");
      logInfo("Retrieving existing webhook secret...");
      webhookEndpoint = existingWebhook;
    } else {
      // Create new webhook endpoint
      logInfo("Creating new webhook endpoint...");

      webhookEndpoint = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          // Customer events
          "customer.created",
          "customer.updated",
          "customer.deleted",

          // Subscription events
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",

          // Payment events
          "payment_intent.succeeded",
          "payment_intent.payment_failed",

          // Invoice events
          "invoice.paid",
          "invoice.payment_failed",

          // Checkout events
          "checkout.session.completed",
          "checkout.session.expired",
        ],
        description: "Auto-generated webhook endpoint for Next.js Stripe integration",
      });

      logSuccess("Created webhook endpoint in Stripe!");
    }

    // Get webhook secret
    const webhookSecret = webhookEndpoint.secret;

    if (!webhookSecret) {
      logError("Failed to retrieve webhook secret from Stripe!");
      process.exit(1);
    }

    logSuccess("Retrieved webhook signing secret");

    // Update .env file
    logInfo("Updating .env file...");
    updateEnvFile(webhookSecret);

    // Success summary
    log("\n" + "=".repeat(60), colors.green);
    log("✓ Webhook Setup Complete!", colors.bright + colors.green);
    log("=".repeat(60), colors.green);

    log("\nWebhook Details:", colors.bright);
    log(`  ID:        ${webhookEndpoint.id}`, colors.cyan);
    log(`  URL:       ${webhookEndpoint.url}`, colors.cyan);
    log(`  Status:    ${webhookEndpoint.status}`, colors.cyan);
    log(`  Events:    ${webhookEndpoint.enabled_events.length} event types`, colors.cyan);

    log("\nNext Steps:", colors.bright);
    log("  1. Restart your dev server (npm run dev)", colors.yellow);
    log("  2. Test webhook events using Stripe CLI:", colors.yellow);
    log("     stripe trigger payment_intent.succeeded", colors.cyan);
    log("  3. View webhook logs in Stripe Dashboard:", colors.yellow);
    log("     https://dashboard.stripe.com/test/webhooks", colors.cyan);

    log("\n" + "=".repeat(60) + "\n", colors.green);

  } catch (error: any) {
    logError("\nFailed to setup webhook:");

    if (error.type === "StripeAuthenticationError") {
      logError("Invalid Stripe API key. Please check your STRIPE_SECRET_KEY in .env");
    } else if (error.type === "StripeConnectionError") {
      logError("Could not connect to Stripe. Please check your internet connection.");
    } else {
      logError(error.message || "Unknown error occurred");
    }

    if (error.raw) {
      log("\nStripe Error Details:", colors.red);
      log(JSON.stringify(error.raw, null, 2), colors.red);
    }

    process.exit(1);
  }
}

// Run the setup
setupStripeWebhook().catch((error) => {
  logError("Unexpected error:");
  console.error(error);
  process.exit(1);
});
