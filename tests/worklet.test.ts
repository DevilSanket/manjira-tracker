import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync("src/features/audio/onset-processor.js", "utf8");
for (const sampleRate of [44100, 48000, 96000]) {
  test(`worklet captures one complete strike at ${sampleRate} Hz without double triggers`, () => {
    let Processor: any;
    const events: any[] = [];
    const context = vm.createContext({
      sampleRate,
      currentTime: 1,
      Float32Array,
      AudioWorkletProcessor: class {
        port = { postMessage: (event: any) => events.push(event) };
      },
      registerProcessor: (_name: string, processor: any) => {
        Processor = processor;
      },
    });
    vm.runInContext(source, context);
    const processor = new Processor();
    for (let block = 0; block < 100; block++) {
      context.currentTime = 1 + (block * 128) / sampleRate;
      const samples = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        const t = (block * 128 + i) / sampleRate;
        samples[i] = 0.8 * Math.exp(-40 * t) * Math.sin(2 * Math.PI * 3500 * t);
      }
      processor.process([[samples]], [], { threshold: [0.005] });
    }
    assert.equal(events.length, 1);
    assert.equal(events[0].payload.timestamp, 1000);
    assert.ok(events[0].payload.buffer.length >= sampleRate * 0.039);
    assert.ok(events[0].payload.buffer.length <= sampleRate * 0.045 + 128);
  });
}
