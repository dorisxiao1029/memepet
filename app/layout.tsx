import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemePet — Your On-Chain Trading Companion",
  description: "An AI pet that reads your wallet, reacts to your trades, and grows with your BSC meme journey.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-nunito">{children}</body>
    </html>
  );
}
