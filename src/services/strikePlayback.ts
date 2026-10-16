import type { StrikeType } from "../store/useAppStore";
export async function playStrike(type: StrikeType) {
  const { manjiraSynth } = await import("./audioSynth");
  await manjiraSynth.play(type);
}
