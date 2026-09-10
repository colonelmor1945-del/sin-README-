/**
 * Shared domain types.
 *
 * Provenance is a first-class field on every piece of game data. GTA 6 has not
 * shipped, so the product must never present an estimate as a confirmed fact.
 * See src/lib/provenance.ts for the display rules.
 */

export type Provenance =
  /** Confirmed by an official Rockstar source. Nothing in the seed set qualifies yet. */
  | "verified"
  /** Reported by players and cross-checked across at least two sources. */
  | "community"
  /** Derived from other data by our own formulas. */
  | "estimated"
  /** Produced by the AI. Lowest confidence. Never shown without the label. */
  | "ai-projection";

export type Tier = "free" | "pro" | "elite";

export type Trend = "up" | "strong-up" | "flat" | "down";
export type Advice = "buy" | "hold" | "wait" | "analyze";

export interface Asset {
  id: string;
  name: string;
  category: "business" | "property" | "vehicle" | "service";
  price: number;
  /** Net income per in-game day, after upkeep. */
  dailyNet: number;
  upkeep: number;
  trend: Trend;
  advice: Advice;
  /** Last 12 sampled prices, oldest first. Drives the sparkline. */
  history: number[];
  unlockLevel: number;
  region: string;
  note: string;
  provenance: Provenance;
}

export interface Mission {
  id: string;
  name: string;
  strand: string;
  payout: number;
  /** Minutes. */
  duration: number;
  /** 1 to 5. */
  difficulty: number;
  crewRequired: number;
  bestStrategy: string;
  prerequisites: string[];
  region: string;
  image: string;
  tips: string[];
  provenance: Provenance;
}

export type PinKind =
  | "mission"
  | "business"
  | "property"
  | "money-spot"
  | "vehicle"
  | "activity";

export interface MapPin {
  id: string;
  name: string;
  kind: PinKind;
  /** Percentages of the map viewport, 0 to 100. */
  x: number;
  y: number;
  region: string;
  detail: string;
  value: number;
  provenance: Provenance;
}

export type PlanStrategy =
  | "fastest-money"
  | "safest"
  | "max-profit"
  | "low-investment"
  | "solo"
  | "multiplayer";

export interface PlayerProfile {
  currentMoney: number;
  level: number;
  ownedAssetIds: string[];
  completedMissionIds: string[];
  playstyle: PlanStrategy;
  goal: number;
}

export interface PlanStep {
  order: number;
  title: string;
  detail: string;
  kind: "mission" | "purchase" | "investment" | "grind";
  estMinutes: number;
  estProfit: number;
  /** Cash you must have on hand before starting this step. */
  requiredCash: number;
  done?: boolean;
}

export interface MoneyPlan {
  id: string;
  objective: number;
  startingCash: number;
  strategy: PlanStrategy;
  summary: string;
  steps: PlanStep[];
  risks: string[];
  /** Every generated plan is an AI projection. Kept explicit so the UI cannot forget. */
  provenance: Provenance;
  generatedBy: "claude" | "heuristic";
  createdAt: string;
}

export interface ScriptBeat {
  /** Seconds from the start of the video. */
  at: number;
  label: string;
  /** What the creator says, written to be read aloud. */
  narration: string;
  /** What is on screen while they say it. */
  onScreen: string;
}

export interface CreatorIdea {
  topic: string;
  momentum: number;
  titles: string[];
  thumbnailConcept: string;
  hook: string;
  angle: string;
  seoKeywords: string[];
  script: ScriptBeat[];
  runtimeSeconds: number;
  provenance: Provenance;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* Monetisation ---------------------------------------------------------- */

export type PaymentStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "failed"
  | "expired"
  | "refunded";

export type SupporterLevel = "supporter" | "early-supporter" | "founding-supporter";

export interface CreditBalance {
  userId: string;
  balance: number;
  updatedAt: string;
}

export type CreditReason =
  | "signup-grant"
  | "monthly-grant"
  | "purchase"
  | "ai-assistant"
  | "money-plan"
  | "creator-lab"
  | "admin-adjustment";
