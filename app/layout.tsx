import type { Metadata } from "next";
import { Orbitron, Roboto } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

const roboto = Roboto({
  weight: ["300", "400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

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
    <html lang="en" className={`${orbitron.variable} ${roboto.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
