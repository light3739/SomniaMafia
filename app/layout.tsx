import { DynamicBackground } from '@/components/ui/DynamicBackground';
import { Cinzel, Montserrat } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { LazyAudio } from "@/components/ui/LazyAudio";
import { SmokeOverlay } from '@/components/ui/SmokeOverlay';
import { TwitterFloating } from '@/components/ui/TwitterFloating';

const cinzel = Cinzel({
  subsets: ["latin", "latin-ext"],
  variable: "--font-cinzel",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
});

import { Rajdhani, Share_Tech_Mono } from "next/font/google";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-share-tech-mono",
});

export const metadata = {
  title: "Mafia Onchain — Where every lie has a price",
  description:
    "Hidden roles, voice chat, fully on-chain prizes, 4–16 players. Lie, vote, win the pot.",
  metadataBase: new URL("https://mafiaonchain.live"),
  openGraph: {
    title: "Mafia Onchain — Where every lie has a price",
    description:
      "Hidden roles, voice chat, fully on-chain prizes, 4–16 players.",
    url: "https://mafiaonchain.live",
    siteName: "Mafia Onchain",
    images: [
      {
        url: "/images/mainscreen.png",
        width: 1200,
        height: 630,
        alt: "Mafia Onchain — Where every lie has a price",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mafia Onchain — Where every lie has a price",
    description:
      "Hidden roles, voice chat, fully on-chain prizes, 4–16 players.",
    images: ["/images/mainscreen.png"],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://auth.privy.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://explorer-api.walletconnect.com" crossOrigin="anonymous" />
      </head>
      <body className={`${cinzel.variable} ${montserrat.variable} ${rajdhani.variable} ${shareTechMono.variable} antialiased bg-black text-white selection:bg-green-500 selection:text-black font-sans overflow-hidden`}>
        <Providers>
          <LazyAudio />
          <DynamicBackground />
          {/* Persistent smoke — lives outside router, never remounts on navigation */}
          <SmokeOverlay />
          <TwitterFloating />
          {children}
        </Providers>
      </body>
    </html>
  );
}
