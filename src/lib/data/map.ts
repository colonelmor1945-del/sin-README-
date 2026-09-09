import type { MapPin, PinKind } from "@/lib/types";

/**
 * PLACEHOLDER MAP DATA. Coordinates are percentages of a stylised Leonida
 * layout drawn in code, not a Rockstar map asset.
 *
 * The shape is deliberately flat so verified locations can be appended by an
 * editor or an import job without touching the rendering layer.
 */
export const MAP_PINS: MapPin[] = [
  { id: "p1", name: "The Neon Ledger", kind: "mission", x: 31, y: 24, region: "Vice Beach", detail: "Cartel strand finale", value: 738_000, provenance: "estimated" },
  { id: "p2", name: "Road to Riches", kind: "mission", x: 44, y: 38, region: "Downtown Vice", detail: "Jason and Lucia strand", value: 512_000, provenance: "community" },
  { id: "p3", name: "Sunshine Freight", kind: "mission", x: 62, y: 79, region: "Leonida Keys", detail: "Smuggling run", value: 186_400, provenance: "community" },
  { id: "p4", name: "Gator Run", kind: "mission", x: 22, y: 62, region: "Everglades", detail: "Delivery, no combat", value: 94_800, provenance: "community" },
  { id: "p5", name: "Kelly County Payroll", kind: "mission", x: 71, y: 18, region: "Kelly County", detail: "Repeatable grind loop", value: 241_600, provenance: "community" },
  { id: "p6", name: "Vice Beach Nightclub", kind: "business", x: 34, y: 29, region: "Vice Beach", detail: "Passive income, 268.9k a day", value: 4_752_000, provenance: "community" },
  { id: "p7", name: "Little Haiti Arcade", kind: "business", x: 40, y: 33, region: "Little Haiti", detail: "Planning room unlock", value: 1_234_800, provenance: "community" },
  { id: "p8", name: "Port Gellhorn Salvage", kind: "business", x: 78, y: 34, region: "Port Gellhorn", detail: "Capital heavy, steady", value: 1_408_000, provenance: "estimated" },
  { id: "p9", name: "Document Forgery Office", kind: "business", x: 46, y: 44, region: "Downtown Vice", detail: "Sliding, wait for the floor", value: 844_600, provenance: "community" },
  { id: "p10", name: "Keys Marina Slip 14", kind: "property", x: 58, y: 74, region: "Leonida Keys", detail: "Boat access spawn", value: 1_896_000, provenance: "community" },
  { id: "p11", name: "Ocean Drive Penthouse", kind: "property", x: 30, y: 20, region: "Vice Beach", detail: "Closest respawn to the club", value: 2_140_000, provenance: "estimated" },
  { id: "p12", name: "Airport Cargo Hold", kind: "money-spot", x: 66, y: 47, region: "Escobar Intl", detail: "Roughly 18k a sweep, 6 minute cooldown", value: 18_000, provenance: "community" },
  { id: "p13", name: "Bayside Armored Route", kind: "money-spot", x: 53, y: 55, region: "Bayside", detail: "Two trucks per in-game day", value: 34_500, provenance: "community" },
  { id: "p14", name: "Casino Back Office", kind: "money-spot", x: 37, y: 41, region: "Vice City", detail: "Chip skim, resets nightly", value: 27_200, provenance: "estimated" },
  { id: "p15", name: "Acid Lab route", kind: "business", x: 26, y: 51, region: "Everglades", detail: "Best return on early capital", value: 749_200, provenance: "community" },
  { id: "p16", name: "Vercetti Motors lot", kind: "vehicle", x: 48, y: 27, region: "Vice City", detail: "Only lot stocking the Virtue", value: 1_118_500, provenance: "estimated" },
  { id: "p17", name: "Sabre turbo spawn", kind: "vehicle", x: 68, y: 62, region: "Bayside", detail: "Free spawn, resets on session change", value: 0, provenance: "community" },
  { id: "p18", name: "Street race circuit", kind: "activity", x: 41, y: 68, region: "Everglades", detail: "Entry 12k, pot scales with grid size", value: 74_000, provenance: "community" },
  { id: "p19", name: "Offshore poker room", kind: "activity", x: 74, y: 71, region: "Leonida Keys", detail: "Variance heavy. Not a reliable income source", value: 0, provenance: "estimated" },
];

export const PIN_KINDS: { id: PinKind; label: string }[] = [
  { id: "mission", label: "Missions" },
  { id: "business", label: "Businesses" },
  { id: "property", label: "Properties" },
  { id: "money-spot", label: "Money spots" },
  { id: "vehicle", label: "Vehicles" },
  { id: "activity", label: "Activities" },
];
