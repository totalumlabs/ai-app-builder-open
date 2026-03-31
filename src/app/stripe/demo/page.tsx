"use client";

/**
 * Stripe Demo Page
 *
 * This page demonstrates how to:
 * 1. Fetch products and prices from Stripe (auto-created if none exist)
 * 2. Create checkout sessions for one-time payments
 * 3. Create checkout sessions for subscriptions
 * 4. Redirect to Stripe checkout
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Price {
  id: string;
  amount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  nickname: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

export default function StripeDemoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPriceId, setProcessingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get<Product[]>("/api/stripe/products");

      if (res.ok && res.data) {
        setProducts(res.data);
      } else {
        setError("Failed to load products. Make sure STRIPE_SECRET_KEY is set in .env");
      }
    } catch (err) {
      setError("Failed to fetch products. Make sure STRIPE_SECRET_KEY is set in .env");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (priceId: string, isSubscription: boolean) => {
    setProcessingPriceId(priceId);
    setError(null);

    try {
      const res = await api.post<{ sessionId: string; url: string }>(
        "/api/stripe/create-checkout-session",
        {
          priceId,
          mode: isSubscription ? "subscription" : "payment",
          savePaymentMethod: !isSubscription, // Save payment method for one-time payments
          customerEmail: "demo@example.com", // Optional: pre-fill customer email
        }
      );

      if (res.ok && res.data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = res.data.url;
      } else {
        setError("Failed to create checkout session");
      }
    } catch (err) {
      setError("Failed to initiate checkout");
      console.error(err);
    } finally {
      setProcessingPriceId(null);
    }
  };

  const formatPrice = (amount: number, currency: string, interval: string | null) => {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);

    if (interval) {
      return `${formatted}/${interval}`;
    }

    return formatted;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Loading products...</h2>
          <p className="text-gray-600">
            Fetching available products from Stripe
            <br />
            <span className="text-sm text-gray-500 mt-1 block">
              Products will be auto-created if none exist
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Stripe Integration Demo</h1>
          <p className="text-xl text-gray-600 mb-6">
            Test one-time payments and subscriptions
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 max-w-2xl mx-auto">
              {error}
            </div>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">No Products Available</h2>
            <p className="text-gray-600 mb-4">
              Products should have been auto-created when you accessed this page.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              If you see this message, please check that:
            </p>
            <ul className="text-left text-sm text-gray-600 mb-6 max-w-md mx-auto space-y-2">
              <li>✓ STRIPE_SECRET_KEY is set in your .env file</li>
              <li>✓ Your Stripe API key is valid</li>
              <li>✓ You have a working internet connection</li>
            </ul>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-md overflow-hidden transition-shadow hover:shadow-lg"
              >
                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2">{product.name}</h3>
                  <p className="text-gray-600 mb-4">{product.description}</p>

                  <div className="space-y-3">
                    {product.prices.map((price) => (
                      <div
                        key={price.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <p className="text-xl font-bold">
                              {formatPrice(price.amount, price.currency, price.interval)}
                            </p>
                            {price.nickname && (
                              <p className="text-sm text-gray-500">{price.nickname}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleCheckout(price.id, !!price.interval)}
                          disabled={processingPriceId === price.id}
                          className="w-full"
                        >
                          {processingPriceId === price.id
                            ? "Processing..."
                            : price.interval
                            ? "Subscribe"
                            : "Buy Now"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-4xl mx-auto">
          <h3 className="text-lg font-bold mb-2">Testing Instructions:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>Use test card: <code className="bg-blue-100 px-2 py-1 rounded">4242 4242 4242 4242</code></li>
            <li>Any future expiry date (e.g., 12/34)</li>
            <li>Any 3-digit CVC</li>
            <li>Any postal code</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
