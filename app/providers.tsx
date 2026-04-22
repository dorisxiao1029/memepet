"use client";

import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "MemePet",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "2f05a7ce3b8c9a00b4f78f6b2e3d1c4a",
  chains: [bsc, bscTestnet],
  ssr: true,
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00FFAA",
            accentColorForeground: "#000",
            borderRadius: "large",
            overlayBlur: "small",
          })}
          initialChain={bsc}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
