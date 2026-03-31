/**
 * Next.js Instrumentation
 * Runs before everything else - ensures logger loads first
 *
 * IMPORTANT: Disabled for Cloudflare Workers deployment
 * The 'nodejs' runtime check prevents this from running in Workers,
 * but we also need to handle the case where the hook itself fails to load
 */

export function register() {
  // Skip instrumentation in Cloudflare Workers environment
  // Workers don't have process.env.NEXT_RUNTIME === 'nodejs'
  // They also don't support require() in this context
  if (typeof process === 'undefined') {
    return; // Cloudflare Workers environment
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only load logger in actual Node.js environment (dev/build)
    // This won't run in Cloudflare Workers
    try {
      require('./src/lib/backend-logger');
    } catch (error) {
      console.warn('Failed to load backend logger:', error);
    }
  }
}
