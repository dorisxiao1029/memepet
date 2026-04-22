import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

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
      <body className="min-h-full flex flex-col font-nunito">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
