import { Playfair_Display, Inter, Montserrat } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { BackgroundMusic } from "@/components/ui/BackgroundMusic";
import { SoundEffects } from "@/components/ui/SoundEffects";
import Image from "next/image";

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-playfair",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
});

export const metadata = {
  title: "Somnia Mafia | Web3 Social Deduction",
  description: "A synchronized, ZK-powered Mafia game on the Somnia Blockchain. Play directly in your browser with session keys.",
  openGraph: {
    title: "Somnia Mafia",
    description: "Join the conspiracy. Identify the Mafia before it's too late.",
    url: "https://somnia-mafia.vercel.app",
    siteName: "Somnia Mafia",
    images: [
      {
        url: "/assets/lobby_background.png", // Fallback to lobby bg
        width: 1200,
        height: 630,
        alt: "Somnia Mafia Game Board",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Somnia Mafia",
    description: "Web3 Social Deduction on Somnia",
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
      <body className={`${playfair.variable} ${inter.variable} ${montserrat.variable} antialiased text-white selection:bg-green-500 selection:text-black font-sans overflow-hidden`}>
        <Providers>
          <BackgroundMusic />
          <SoundEffects />
          <div className="fixed inset-0 z-0">
            <Image
              src="/assets/lobby_background.webp"
              alt="Lobby Background"
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
