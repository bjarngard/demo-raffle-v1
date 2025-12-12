import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raffle - Enter Now!",
  description: "Enter our raffle and have a chance to win!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
