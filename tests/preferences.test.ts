import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizePreferences } from "../src/lib/preferences";
import { useAppStore } from "../src/store/useAppStore";
test("partial and corrupt settings restore safe defaults instead of breaking audio", () => {
  const defaults = useAppStore.getState();
  assert.deepEqual(sanitizePreferences(null, defaults), {});
  const saved = sanitizePreferences(
    {
      bpm: Infinity,
      timeSignature: 0,
      calibration: { inputLatency: 35, openSamples: ["bad"] },
      sessions: [{ date: "invalid" }],
      completedLessonIds: [null, "lesson_1", "lesson_1"],
      setRecording: "invalid",
    },
    defaults,
  );
  assert.equal(saved.bpm, defaults.bpm);
  assert.equal(saved.timeSignature, defaults.timeSignature);
  assert.equal(saved.calibration?.inputLatency, 35);
  assert.equal(
    saved.calibration?.minStrikePeak,
    defaults.calibration.minStrikePeak,
  );
  assert.deepEqual(saved.calibration?.openSamples, []);
  assert.deepEqual(saved.sessions, []);
  assert.deepEqual(saved.completedLessonIds, ["lesson_1"]);
  assert.equal(saved.setRecording, undefined);
});
