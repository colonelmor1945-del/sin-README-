import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";
import { InstallApp } from "@/components/InstallApp";
import { PanelSpotlight } from "@/components/PanelSpotlight";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  // Without this, Next emits relative OG and canonical URLs, which crawlers
  // and every social scraper resolve against whatever host they happened to
  // fetch from. Absolute or not at all.
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: "/" },
  title: {
    default: "GTA 6 Money Lab",
    template: "%s | GTA 6 Money Lab",
  },
  description:
    "An independent AI intelligence platform for GTA 6 players. Plan money strategies, compare missions by real hourly rate and track asset payback periods.",
  robots: { index: true, follow: true },
  // The manifest is emitted by src/app/manifest.ts. Next links it
  // automatically, but the icons have to be declared here to reach the head.
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // iOS ignores the manifest for these. Without them an installed shortcut
  // opens in a Safari tab with the browser chrome, which is not an app.
  appleWebApp: {
    capable: true,
    title: "Money Lab",
    statusBarStyle: "black-translucent",
  },
  // Next emits the standardised mobile-web-app-capable for the line above.
  // Older iOS reads only the apple- prefixed name, and without it an installed
  // icon opens inside Safari chrome instead of standalone. Both are harmless
  // where they are not needed.
  other: { "apple-mobile-web-app-capable": "yes" },
  openGraph: {
    title: "GTA 6 Money Lab",
    description:
      "Make money. Dominate Vice City. An independent AI intelligence platform for GTA 6 players.",
    type: "website",
  },
};

/**
 * viewport, not metadata.
 *
 * themeColor and viewportFit moved out of the Metadata export in Next 15 and
 * are silently ignored if left there. viewportFit: "cover" is what lets the
 * page paint under the notch and the home indicator once it is installed, and
 * it is the difference between a web page in a frame and something that reads
 * as an app.
 */
export const viewport: Viewport = {
  themeColor: "#08060d",
  colorScheme: "dark",
  viewportFit: "cover",
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
        {/* Registers the service worker everywhere, and offers the install
            prompt only where the browser has actually offered one. */}
        <InstallApp />
      </body>
    </html>
  );
}
