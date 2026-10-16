export function parseTaggedStrike(line: string) {
  const match =
    /^(OPEN|CLOSED)(?:[,: ]+(\d+(?:\.\d+)?))?(?:[,: ]+(\d+(?:\.\d+)?))?$/i.exec(
      line.trim(),
    );
  if (!match) return null;
  const confidence = match[2] ? Number(match[2]) / 100 : 0.9;
  const peakFreq = match[3] ? Number(match[3]) : undefined;
  if (
    confidence < 0 ||
    confidence > 1 ||
    (peakFreq !== undefined && peakFreq > 24000)
  )
    return null;
  return {
    type: match[1].toUpperCase() as "OPEN" | "CLOSED",
    confidence,
    peakFreq,
  };
}
export function normalizeAdc(line: string, bits: 10 | 12) {
  if (!/^\d+$/.test(line.trim())) return null;
  const value = Number(line);
  const midpoint = 2 ** (bits - 1);
  if (value < 0 || value >= midpoint * 2) return null;
  return (value - midpoint) / midpoint;
}
