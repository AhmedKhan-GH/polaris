import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";

import { branding } from "@/lib/branding";
import { getPreferences } from "@/lib/preferences";

import { ChunkErrorReloader } from "./_features/shell";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display face for headings (the Interface System voice). Variable
// font, so no explicit weights — exposed as --font-serif (Tailwind `font-serif`).
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

// Document metadata is sourced from the tenant branding config — never a
// hardcoded product string. Next emits the <title>/<meta> tags from this object.
export const metadata: Metadata = {
  title: branding.productName,
  description: branding.tagline,
};

/**
 * Async so the account's color theme can be resolved server-side and applied as a
 * `dark` class on <html> BEFORE first paint — no flash, and no client theme
 * script. `getPreferences()` fails closed to light (no session / no row), so the
 * login and error surfaces render light without a DB round-trip.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme } = await getPreferences();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased${
        theme === "dark" ? " dark" : ""
      }`}
    >
      <body className="min-h-full flex flex-col">
        <ChunkErrorReloader />
        {children}
      </body>
    </html>
  );
}
