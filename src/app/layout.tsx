import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";
import { PanelSpotlight } from "@/components/PanelSpotlight";

export const metadata: Metadata = {
  title: {
    default: "GTA 6 Money Lab",
    template: "%s | GTA 6 Money Lab",
  },
  description:
    "An independent AI intelligence platform for GTA 6 players. Plan money strategies, compare missions by real hourly rate and track asset payback periods.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "GTA 6 Money Lab",
    description:
      "Make money. Dominate Vice City. An independent AI intelligence platform for GTA 6 players.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        {/* One pointermove listener for the whole page. Draws the neon
            spotlight that follows the cursor across panels. */}
        <PanelSpotlight />
      </body>
    </html>
  );
}
