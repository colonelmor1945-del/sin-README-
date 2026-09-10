import type { CreatorIdea } from "@/lib/types";

/**
 * PLACEHOLDER CREATOR SIGNAL. Momentum is a fictional demo index, not a real
 * search-volume figure. Wire this to a real trends source before launch.
 */
export const CREATOR_IDEAS: CreatorIdea[] = [
  {
    topic: "Which business to buy first",
    momentum: 340,
    titles: [
      "The 5 businesses that actually pay in GTA 6",
      "I ranked every GTA 6 business by real hourly income",
      "Buying the nightclub first is a mistake. Here is why",
    ],
    thumbnailConcept:
      "Split frame. Nightclub exterior on the left, acid lab van on the right, one large red cross over the club.",
    hook: "Everyone buys the nightclub first. It takes eleven hours to break even.",
    angle: "Contrarian ranking backed by payback-period math instead of sticker price.",
    seoKeywords: ["gta 6 best business", "gta 6 first business", "gta 6 nightclub worth it"],
    runtimeSeconds: 95,
    script: [
      {
        at: 0,
        label: "Hook",
        narration:
          "Everyone buys the nightclub first. It takes eleven hours to break even.",
        onScreen:
          "Cold open on the nightclub exterior, then a hard cut to the payback figure.",
      },
      {
        at: 4,
        label: "The trap",
        narration:
          "It looks like the obvious buy. Biggest headline income in the game, and the most expensive thing you can point at.",
        onScreen:
          "Nightclub interior, then the price tag on screen.",
      },
      {
        at: 18,
        label: "The maths",
        narration:
          "Four point seven five million to buy. Two hundred and sixty nine thousand a day. That is around eighteen in-game days before you see a cent of profit.",
        onScreen:
          "Three figures appearing one at a time over a static shot.",
      },
      {
        at: 38,
        label: "The answer",
        narration:
          "The acid lab costs seven hundred and forty nine thousand and nets ninety six thousand a day. Payback in under eight days.",
        onScreen:
          "Cut to the lab van. Same three figures, same layout, so the contrast lands.",
      },
      {
        at: 58,
        label: "The caveat",
        narration:
          "These numbers are community reported and not confirmed by Rockstar. Check them before you spend seven figures.",
        onScreen:
          "Plain text on screen. No footage.",
      },
      {
        at: 72,
        label: "Close",
        narration:
          "Buy the cheap one first. Let it pay for the expensive one.",
        onScreen:
          "Split screen, both businesses, acid lab highlighted.",
      },
    ],
    provenance: "ai-projection",
  },
  {
    topic: "Fastest first million",
    momentum: 212,
    titles: [
      "First million in GTA 6 without touching a heist",
      "The 90 minute route to your first million",
      "I tested 6 money methods. Only two were worth it",
    ],
    thumbnailConcept:
      "Stopwatch at 90:00 over a Vice Beach skyline, cash counter overlay in the corner.",
    hook: "Ninety minutes, no crew, no heist. Here is the exact route.",
    angle: "Solo-friendly, beginner search intent, high replay value.",
    seoKeywords: ["gta 6 first million", "gta 6 money fast", "gta 6 solo money"],
    runtimeSeconds: 110,
    script: [
      {
        at: 0,
        label: "Hook",
        narration:
          "Ninety minutes, no crew, no heist. Here is the exact route.",
        onScreen:
          "Stopwatch starting, Vice Beach skyline behind it.",
      },
      {
        at: 5,
        label: "Why it works",
        narration:
          "Every guide sends you to the big heists. Those need a crew and they punish mistakes. This route needs neither.",
        onScreen:
          "B-roll of a failed heist, then a solo boat run.",
      },
      {
        at: 20,
        label: "Step one",
        narration:
          "Sunshine Freight. Twenty two minutes solo, one hundred and eighty six thousand a run. Take the outer channel, the inner one has patrols.",
        onScreen:
          "Route drawn on the map, outer channel highlighted.",
      },
      {
        at: 45,
        label: "Step two",
        narration:
          "Three runs gets you the acid lab. From there it pays you while you play.",
        onScreen:
          "Purchase screen, then the daily income figure.",
      },
      {
        at: 70,
        label: "The honest part",
        narration:
          "These figures are community reported and unverified. Treat the ninety minutes as a target, not a promise.",
        onScreen:
          "Plain text on screen.",
      },
      {
        at: 85,
        label: "Close",
        narration:
          "Three runs and one purchase. That is the whole route.",
        onScreen:
          "Both steps side by side.",
      },
    ],
    provenance: "ai-projection",
  },
  {
    topic: "Cayo warehouse payback period",
    momentum: 128,
    titles: [
      "Is the Cayo warehouse still worth 2.6 million",
      "The warehouse pays for itself in 13 runs. I counted",
    ],
    thumbnailConcept:
      "Warehouse aerial with a receipt-style overlay listing eight line items.",
    hook: "Two point six million is a lot. I ran the numbers so you do not have to.",
    angle: "Investment analysis format. Performs well with the returning-player audience.",
    seoKeywords: ["cayo perico warehouse", "gta 6 warehouse worth it", "gta 6 passive income"],
    runtimeSeconds: 100,
    script: [
      {
        at: 0,
        label: "Hook",
        narration:
          "Two point six million is a lot. I ran the numbers so you do not have to.",
        onScreen:
          "Warehouse aerial, receipt overlay building up.",
      },
      {
        at: 5,
        label: "The question",
        narration:
          "The warehouse is the biggest single purchase most players consider. The only question that matters is how long it takes to pay you back.",
        onScreen:
          "Price on screen, held.",
      },
      {
        at: 20,
        label: "The number",
        narration:
          "Two hundred and fourteen thousand a day net. Against two point six million, that is roughly twelve in-game days.",
        onScreen:
          "Division worked on screen.",
      },
      {
        at: 40,
        label: "The comparison",
        narration:
          "The acid lab does it in under eight. The warehouse wins on total income, the lab wins on speed.",
        onScreen:
          "Two bars, clearly labelled.",
      },
      {
        at: 62,
        label: "The caveat",
        narration:
          "Every figure here is community reported. Nothing about GTA 6 economy is confirmed yet.",
        onScreen:
          "Plain text on screen.",
      },
      {
        at: 78,
        label: "Close",
        narration:
          "Buy the lab if you are starting. Buy the warehouse when the lab has paid for it.",
        onScreen:
          "Both, in order.",
      },
    ],
    provenance: "ai-projection",
  },
];
