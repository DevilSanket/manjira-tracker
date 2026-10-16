export interface TaalDefinition {
  id: string;
  name: string;
  beats: number;
  description: string;
  division: string;
  bols: string[];
  vibhags: { startBeat: number; type: "sam" | "tali" | "khali" }[];
}

export const TAAL_PRESETS: Record<number, TaalDefinition> = {
  8: {
    id: "keherwa",
    name: "Keherwa",
    beats: 8,
    description: "Bhajans, Kirtan & Folk",
    division: "4 + 4",
    bols: ["Dha", "Ge", "Na", "Ti", "Na", "Ka", "Dhi", "Na"],
    vibhags: [
      { startBeat: 0, type: "sam" },
      { startBeat: 4, type: "khali" },
    ],
  },
  6: {
    id: "dadra",
    name: "Dadra",
    beats: 6,
    description: "Light Classical & Fast Bhajans",
    division: "3 + 3",
    bols: ["Dha", "Dhin", "Na", "Dha", "Tin", "Na"],
    vibhags: [
      { startBeat: 0, type: "sam" },
      { startBeat: 3, type: "khali" },
    ],
  },
  7: {
    id: "roopak",
    name: "Roopak",
    beats: 7,
    description: "Classical & Devotional",
    division: "3 + 2 + 2",
    bols: ["Tin", "Tin", "Na", "Dhin", "Na", "Dhin", "Na"],
    vibhags: [
      { startBeat: 0, type: "khali" },
      { startBeat: 3, type: "tali" },
      { startBeat: 5, type: "tali" },
    ],
  },
  16: {
    id: "teentaal",
    name: "Teentaal",
    beats: 16,
    description: "King of Classical Taals",
    division: "4 + 4 + 4 + 4",
    bols: [
      "Dha",
      "Dhin",
      "Dhin",
      "Dha",
      "Dha",
      "Dhin",
      "Dhin",
      "Dha",
      "Dha",
      "Tin",
      "Tin",
      "Ta",
      "Ta",
      "Dhin",
      "Dhin",
      "Dha",
    ],
    vibhags: [
      { startBeat: 0, type: "sam" },
      { startBeat: 4, type: "tali" },
      { startBeat: 8, type: "khali" },
      { startBeat: 12, type: "tali" },
    ],
  },
  4: {
    id: "chaupalli",
    name: "Basic 4/4",
    beats: 4,
    description: "Steady 4-Beat Pulse",
    division: "2 + 2",
    bols: ["Dha", "Ge", "Na", "Tin"],
    vibhags: [
      { startBeat: 0, type: "sam" },
      { startBeat: 2, type: "khali" },
    ],
  },
};
