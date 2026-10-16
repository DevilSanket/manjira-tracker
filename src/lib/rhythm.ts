export type Verdict = "PERFECT" | "NEAR" | "MISS";
export function timingAt(timestamp: number, origin: number, bpm: number) {
  const duration = 60000 / bpm;
  const beat = Math.round((timestamp - origin) / duration) || 0;
  const delta = timestamp - (origin + beat * duration);
  const verdict: Verdict =
    Math.abs(delta) < 50 ? "PERFECT" : Math.abs(delta) < 150 ? "NEAR" : "MISS";
  return { beat, delta, verdict };
}
export function timingAccuracy(stats: {
  perfect: number;
  near: number;
  miss: number;
}) {
  const total = stats.perfect + stats.near + stats.miss;
  return total ? (100 * stats.perfect + 50 * stats.near) / total : 0;
}
export type NoteType = "OPEN" | "CLOSED" | "NONE";
export class TrainingLedger {
  readonly resolved = new Set<number>();
  constructor(
    readonly notes: NoteType[],
    readonly bpm: number,
  ) {}
  hit(timestamp: number, origin: number, type: NoteType) {
    const timing = timingAt(timestamp, origin, this.bpm);
    const expected = this.notes[timing.beat];
    if (
      !expected ||
      expected === "NONE" ||
      timing.verdict === "MISS" ||
      this.resolved.has(timing.beat)
    ) {
      return { ...timing, correct: false, accepted: false };
    }
    this.resolved.add(timing.beat);
    return { ...timing, accepted: true, correct: expected === type };
  }
  expire(timestamp: number, origin: number) {
    const missed: number[] = [];
    this.notes.forEach((type, beat) => {
      if (
        type !== "NONE" &&
        !this.resolved.has(beat) &&
        timestamp > origin + (beat * 60000) / this.bpm + 150
      ) {
        this.resolved.add(beat);
        missed.push(beat);
      }
    });
    return missed;
  }
}
