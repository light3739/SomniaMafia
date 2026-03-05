import { DynamicBackground } from '@/components/ui/DynamicBackground';
import { Cinzel, Montserrat } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { BackgroundMusic } from "@/components/ui/BackgroundMusic";
import { SoundEffects } from "@/components/ui/SoundEffects";

const cinzel = Cinzel({
  subsets: ["latin", "cyrillic"],
  variable: "--font-cinzel",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
});

export const metadata = {
  title: "Onchain Mafia | Web3 Social Deduction",
  description: "A synchronized, ZK-powered Mafia game on the Somnia and Avalanche Blockchains. Play directly in your browser with session keys.",
  metadataBase: new URL("https://mafiaonchain.live"),
  openGraph: {
    title: "Onchain Mafia",
    description: "Join the conspiracy. Identify the Mafia before it's too late.",
    url: "https://mafiaonchain.live",
    siteName: "Onchain Mafia",
    images: [
      {
        url: "/assets/lobby_background.png", // Fallback to lobby bg
        width: 1200,
        height: 630,
        alt: "Onchain Mafia Game Board",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Mafia",
    description: "Web3 Social Deduction",
    images: ["/assets/lobby_background.png"],
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
      <body className={`${cinzel.variable} ${montserrat.variable} antialiased bg-black text-white selection:bg-green-500 selection:text-black font-sans overflow-hidden`}>
        <Providers>
          <BackgroundMusic />
          <SoundEffects />
          <DynamicBackground />
          {children}
        </Providers>
      </body>
    </html>
  );
}
