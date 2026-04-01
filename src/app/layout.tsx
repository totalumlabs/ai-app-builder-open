// src/app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ScriptExecutor } from "@/components/ScriptExecutor";
import { DevToolsHandler } from "@/components/DevToolsHandler";
import { GlobalErrorCatcher } from "@/components/GlobalErrorCatcher";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VibeBuild — AI App Builder",
  description: "Build apps with AI. Describe what you want, preview in real-time, deploy with one click.",
};

// SUPER IMPORTANT: NOT EDIT THE FOLLOWING 2 LINES TO FORCE NEXT.JS TO RENDER DYNAMICALLY
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          <GlobalErrorCatcher />
          <ScriptExecutor />
          <DevToolsHandler />
          <Toaster position="top-right" richColors />
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">{children}</main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
