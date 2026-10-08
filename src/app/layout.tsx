import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UVU Ambassadors", template: "%s · UVU Ambassadors" },
  description: "Sign up for tours, events and high school visits.",
};

export const viewport: Viewport = {
  themeColor: "#f6f7f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
