import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Token Security Copilot",
  description: "AI-powered pre-entry risk check for DEX tokens",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
