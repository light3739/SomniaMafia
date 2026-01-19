import { Providers } from "./providers";
import "./globals.css";
import { BackgroundMusic } from "@/components/ui/BackgroundMusic";
import { SoundEffects } from "@/components/ui/SoundEffects";

export const metadata = {
  title: "Somnia Mafia",
  description: "Web3 Mafia Game on Somnia Blockchain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-white selection:bg-green-500 selection:text-black font-sans overflow-hidden">
        <BackgroundMusic />
        <SoundEffects />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
