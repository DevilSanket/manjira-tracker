import { test } from "node:test";
import assert from "node:assert/strict";
import { useAppStore } from "../src/store/useAppStore";
const strike = (verdict: "PERFECT" | "MISS") => ({
  label: "OPEN" as const,
  confidence: 0.9,
  timestamp: 1000,
  timingDeltaMs: 0,
  timingVerdict: verdict,
  peakRms: 0.5,
  zcr: 0.2,
  decayRatio: 0.4,
});
test("store averages all timed strikes and keeps the best streak", () => {
  const state = useAppStore.getState();
  state.resetGameplay();
  state.setMetronomeActive(true);
  state.addStrike(strike("PERFECT"));
  state.addStrike(strike("MISS"));
  state.addStrike(strike("PERFECT"));
  assert.equal(useAppStore.getState().accuracy, 200 / 3);
  assert.equal(useAppStore.getState().combo, 1);
  assert.equal(useAppStore.getState().sessionStats.miss, 1);
  state.addMissedNotes(2);
  assert.equal(useAppStore.getState().accuracy, 40);
  assert.equal(useAppStore.getState().sessionStats.incorrectType, 2);
});
test("free play does not claim measured timing accuracy", () => {
  const state = useAppStore.getState();
  state.resetGameplay();
  state.setMetronomeActive(false);
  state.addStrike(strike("PERFECT"));
  assert.equal(useAppStore.getState().sessionStats.perfect, 0);
  assert.equal(useAppStore.getState().accuracy, 0);
});
test("input switching and serial disconnection stop recording", () => {
  const state = useAppStore.getState();
  state.setRecording(true);
  state.setMetronomeActive(true);
  state.setInputMode("serial");
  assert.equal(useAppStore.getState().isRecording, false);
  state.setSerialConnected(true);
  state.setRecording(true);
  state.setSerialConnected(false);
  assert.equal(useAppStore.getState().isRecording, false);
});
test("session snapshots do not change when gameplay resets", () => {
  const state = useAppStore.getState();
  state.resetGameplay();
  state.evaluateStrike(true);
  state.saveSession("Test");
  const saved = useAppStore.getState().sessions[0];
  state.resetGameplay();
  assert.equal(saved.stats.correctType, 1);
  assert.equal(saved.accuracy, 100);
  state.completeLesson("lesson_1");
  state.completeLesson("lesson_1");
  assert.equal(
    useAppStore.getState().completedLessonIds.filter((id) => id === "lesson_1")
      .length,
    1,
  );
});
test("best evaluated streak resets on wrong sounds and missed notes", () => {
  const state = useAppStore.getState();
  state.resetGameplay();
  state.evaluateStrike(true);
  state.evaluateStrike(true);
  state.evaluateStrike(false);
  state.evaluateStrike(true);
  assert.equal(useAppStore.getState().evaluationCombo, 1);
  assert.equal(useAppStore.getState().bestEvaluationCombo, 2);
  state.addMissedNotes(1);
  assert.equal(useAppStore.getState().evaluationCombo, 0);
});
