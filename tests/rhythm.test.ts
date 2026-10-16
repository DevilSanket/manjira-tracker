import { test } from "node:test";
import assert from "node:assert/strict";
import { timingAt, timingAccuracy, TrainingLedger } from "../src/lib/rhythm";
import { parseTaggedStrike, normalizeAdc } from "../src/lib/serialProtocol";
import { audioErrorMessage } from "../src/lib/audioErrors";
test("timing uses scheduled onset, including early hits and verdict boundaries", () => {
  assert.deepEqual(timingAt(995, 1000, 60), {
    beat: 0,
    delta: -5,
    verdict: "PERFECT",
  });
  assert.equal(timingAt(1049, 1000, 60).verdict, "PERFECT");
  assert.equal(timingAt(1050, 1000, 60).verdict, "NEAR");
  assert.equal(timingAt(1150, 1000, 60).verdict, "MISS");
  assert.equal(timingAt(1970, 1000, 60).delta, -30);
  assert.equal(timingAt(1500, 1000, 120).beat, 1);
});
test("accuracy retains earlier misses after a combo restarts", () => {
  assert.equal(timingAccuracy({ perfect: 2, near: 0, miss: 1 }), 200 / 3);
  assert.equal(timingAccuracy({ perfect: 1, near: 1, miss: 1 }), 50);
  assert.equal(timingAccuracy({ perfect: 0, near: 0, miss: 0 }), 0);
});
test("training accepts one strike per note and rejects rests and wrong sounds", () => {
  const ledger = new TrainingLedger(["OPEN", "NONE", "CLOSED"], 60);
  assert.equal(ledger.hit(1000, 1000, "OPEN").correct, true);
  assert.equal(ledger.hit(1050, 1000, "OPEN").accepted, false);
  assert.equal(ledger.hit(2000, 1000, "CLOSED").accepted, false);
  assert.deepEqual(ledger.hit(3000, 1000, "OPEN"), {
    beat: 2,
    delta: 0,
    verdict: "PERFECT",
    accepted: true,
    correct: false,
  });
  assert.deepEqual(ledger.expire(5000, 1000), []);
});
test("silence produces one miss per expected note and no penalties for rests", () => {
  const ledger = new TrainingLedger(["OPEN", "NONE", "CLOSED"], 60);
  assert.deepEqual(ledger.expire(1150, 1000), []);
  assert.deepEqual(ledger.expire(1151, 1000), [0]);
  assert.deepEqual(ledger.expire(4000, 1000), [2]);
  assert.deepEqual(ledger.expire(5000, 1000), []);
});
test("serial accepts explicit valid tags and rejects malformed telemetry", () => {
  assert.deepEqual(parseTaggedStrike("OPEN,92,3450"), {
    type: "OPEN",
    confidence: 0.92,
    peakFreq: 3450,
  });
  for (const line of [
    "OPENISH,92",
    "OPEN,NaN,0",
    "CLOSED,101",
    "OPEN,90,50000",
    "OPEN,90,1000,trailing",
  ])
    assert.equal(parseTaggedStrike(line), null);
});
test("ADC normalization requires configured resolution and validates complete readings", () => {
  assert.equal(normalizeAdc("2048", 12), 0);
  assert.equal(normalizeAdc("512", 10), 0);
  assert.equal(normalizeAdc("0", 12), -1);
  assert.equal(normalizeAdc("4095", 12), 2047 / 2048);
  for (const line of ["4096", "-1", "123abc", "NaN", "0.5"])
    assert.equal(normalizeAdc(line, 12), null);
  assert.equal(normalizeAdc("2048", 10), null);
});
test("permission and device errors explain recovery", () => {
  assert.match(
    audioErrorMessage(new DOMException("", "NotAllowedError")),
    /Allow microphone access/,
  );
  assert.match(
    audioErrorMessage(new DOMException("", "NotFoundError")),
    /choose another input/,
  );
});
