import { PRICING } from "@/lib/pricing";
import { siteUrl } from "@/lib/site";

/**
 * Structured data for the landing page.
 *
 * This is what lets a search engine show the thing as an application with a
 * price rather than as an anonymous blue link, and it is the closest a web app
 * gets to a store listing.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT DO
 * It does not claim any relationship with Rockstar Games or Take-Two. The
 * description says "independent" and "not affiliated" in the same sentence
 * that mentions the game, because this markup is machine-readable and gets
 * quoted back in results, so it is exactly the wrong place to be ambiguous
 * about who made what.
 *
 * It does not carry an aggregateRating. There are no ratings. Inventing one is
 * both against Google's guidelines and the same lie the provenance system
 * exists to make impossible everywhere else in this product.
 */
export function StructuredData() {
  const base = siteUrl();

  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "GTA 6 Money Lab",
    url: base,
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    description:
      "An independent, fan-made AI intelligence platform for Grand Theft Auto VI players. Plan money strategies, compare missions by risk-adjusted hourly rate and track asset payback periods. Not affiliated with, endorsed by, or associated with Rockstar Games or Take-Two Interactive.",
    inLanguage: "en",
    isFamilyFriendly: false,
    // A free tier that is genuinely usable without paying, plus the paid ones.
    // Listing only the paid tiers would read as a paywall, which it is not.
    offers: [
      {
        "@type": "Offer",
        name: PRICING.free.label,
        price: "0",
        priceCurrency: "EUR",
        category: "free",
      },
      {
        "@type": "Offer",
        name: PRICING.pro.label,
        price: (PRICING.pro.monthlyMinor / 100).toFixed(2),
        priceCurrency: "EUR",
      },
      {
        "@type": "Offer",
        name: PRICING.elite.label,
        price: (PRICING.elite.monthlyMinor / 100).toFixed(2),
        priceCurrency: "EUR",
      },
    ],
    // Names the subject without implying ownership of it.
    about: {
      "@type": "VideoGame",
      name: "Grand Theft Auto VI",
      publisher: { "@type": "Organization", name: "Rockstar Games" },
    },
    disambiguatingDescription:
      "Independent fan project. Not an official Rockstar Games or Take-Two Interactive product.",
  };

  return (
    <script
      type="application/ld+json"
      // The value is built here from our own constants, never from user input
      // or from anything ingested, so there is no untrusted string in it.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
