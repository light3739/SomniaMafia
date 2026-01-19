import { Providers } from "./providers";
import "./globals.css";

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
      <body className="antialiased bg-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
