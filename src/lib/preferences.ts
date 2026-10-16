import type {
  AppState,
  CalibrationSample,
  SavedSession,
} from "../store/useAppStore";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
const sample = (value: unknown): value is CalibrationSample =>
  object(value) &&
  ["zcr", "crestFactor", "decayRatio", "peakProminence"].every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  );
const session = (value: unknown): value is SavedSession =>
  object(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.date === "string" &&
  Number.isFinite(Date.parse(value.date)) &&
  typeof value.bpm === "number" &&
  Number.isFinite(value.bpm) &&
  typeof value.accuracy === "number" &&
  Number.isFinite(value.accuracy) &&
  object(value.stats) &&
  ["correctType", "incorrectType", "perfect", "near", "miss"].every(
    (key) =>
      typeof (value.stats as Record<string, unknown>)[key] === "number" &&
      Number.isFinite((value.stats as Record<string, unknown>)[key]),
  );
export function sanitizePreferences(
  value: unknown,
  defaults: AppState,
): Partial<AppState> {
  if (!object(value)) return {};
  const result: Partial<AppState> = {};
  result.bpm = Math.round(number(value.bpm, defaults.bpm, 40, 220));
  result.timeSignature = [4, 6, 7, 8, 16].includes(Number(value.timeSignature))
    ? Number(value.timeSignature)
    : defaults.timeSignature;
  result.selectedAudioDeviceId =
    typeof value.selectedAudioDeviceId === "string"
      ? value.selectedAudioDeviceId
      : "";
  result.serialAdcBits = value.serialAdcBits === 10 ? 10 : 12;
  result.serialSampleRate = number(
    value.serialSampleRate,
    defaults.serialSampleRate,
    200,
    2000,
  );
  result.completedLessonIds = Array.isArray(value.completedLessonIds)
    ? [
        ...new Set(
          value.completedLessonIds.filter(
            (id): id is string => typeof id === "string",
          ),
        ),
      ]
    : [];
  result.sessions = Array.isArray(value.sessions)
    ? value.sessions.filter(session).slice(0, 100)
    : [];
  if (object(value.calibration)) {
    const cal = value.calibration;
    result.calibration = {
      ...defaults.calibration,
      noiseFloor: number(cal.noiseFloor, defaults.calibration.noiseFloor, 0, 1),
      openZcr: number(cal.openZcr, defaults.calibration.openZcr, 0, 1),
      closedZcr: number(cal.closedZcr, defaults.calibration.closedZcr, 0, 1),
      minStrikePeak: number(
        cal.minStrikePeak,
        defaults.calibration.minStrikePeak,
        0.001,
        0.8,
      ),
      maxStrikePeak: number(
        cal.maxStrikePeak,
        defaults.calibration.maxStrikePeak,
        0.01,
        1,
      ),
      inputLatency: number(
        cal.inputLatency,
        defaults.calibration.inputLatency,
        0,
        200,
      ),
      openSamples: Array.isArray(cal.openSamples)
        ? cal.openSamples.filter(sample).slice(0, 50)
        : [],
      closedSamples: Array.isArray(cal.closedSamples)
        ? cal.closedSamples.filter(sample).slice(0, 50)
        : [],
    };
  }
  return result;
}
