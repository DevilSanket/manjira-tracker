import { useAppStore } from "../store/useAppStore";
import { normalizeAdc, parseTaggedStrike } from "../lib/serialProtocol";
import { audioErrorMessage } from "../lib/audioErrors";
export class SerialManager {
  private port: any = null;
  private reader: any = null;
  private reading: Promise<void> | null = null;
  private keepReading = false;
  private onStrike: ((data: any) => void) | null = null;
  private lastStrikeTime = -Infinity;
  private lineBuffer = "";
  private clippingTimer: ReturnType<typeof setTimeout> | null = null;
  private capture: {
    timestamp: number;
    samples: number[];
    count: number;
  } | null = null;
  private previousMagnitude = 0;
  isSupported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }
  async connect(baudRate = 115200) {
    if (!this.isSupported())
      throw new Error("USB serial requires Chrome, Edge, or the desktop app.");
    await this.disconnect();
    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate });
      const info = this.port.getInfo();
      useAppStore
        .getState()
        .setSerialConnected(
          true,
          info.usbVendorId
            ? `USB ${info.usbVendorId.toString(16)}`
            : "USB serial",
        );
      this.keepReading = true;
      this.lastStrikeTime = -Infinity;
      this.lineBuffer = "";
      this.capture = null;
      this.previousMagnitude = 0;
      this.reading = this.readLoop();
      return true;
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }
  async disconnect() {
    this.keepReading = false;
    if (this.reader) await this.reader.cancel().catch(() => {});
    await this.reading?.catch(() => {});
    this.reading = null;
    if (this.port) await this.port.close().catch(() => {});
    this.port = null;
    this.reader = null;
    this.capture = null;
    if (this.clippingTimer) clearTimeout(this.clippingTimer);
    useAppStore.getState().setIsClipping(false);
    useAppStore.getState().setSerialConnected(false);
  }
  setStrikeCallback(cb: ((data: any) => void) | null) {
    this.onStrike = cb;
  }
  private async readLoop() {
    const reader = this.port.readable.getReader();
    this.reader = reader;
    const decoder = new TextDecoder();
    try {
      while (this.keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        this.lineBuffer += decoder.decode(value, { stream: true });
        const lines = this.lineBuffer.split(/\r?\n/);
        this.lineBuffer = lines.pop() ?? "";
        if (this.lineBuffer.length > 4096)
          throw new Error(
            "Serial data is missing line endings. Send one reading per line.",
          );
        for (const line of lines) this.handleSerialLine(line.trim());
      }
    } catch (error) {
      if (this.keepReading)
        useAppStore
          .getState()
          .setAudioStatus(
            "error",
            `USB connection interrupted. ${audioErrorMessage(error)}`,
          );
    } finally {
      reader.releaseLock();
      this.reader = null;
      const unexpected = this.keepReading;
      this.keepReading = false;
      if (unexpected) {
        useAppStore.getState().setSerialConnected(false);
        useAppStore
          .getState()
          .setAudioStatus(
            "error",
            "USB serial disconnected. Reconnect your device and try again.",
          );
      }
    }
  }
  private handleSerialLine(line: string) {
    const now = performance.now();
    const tagged = parseTaggedStrike(line);
    if (tagged) {
      if (now - this.lastStrikeTime < 90) return;
      this.lastStrikeTime = now;
      this.onStrike?.({
        ...tagged,
        timestamp: now,
        peak: 0.85,
        zcr: 0,
        decayRatio: 0,
      });
      return;
    }
    const state = useAppStore.getState();
    const normalized = normalizeAdc(line, state.serialAdcBits);
    if (normalized === null) return;
    const magnitude = Math.abs(normalized);
    if (magnitude >= 0.95) {
      state.setIsClipping(true);
      if (this.clippingTimer) clearTimeout(this.clippingTimer);
      this.clippingTimer = setTimeout(
        () => useAppStore.getState().setIsClipping(false),
        1200,
      );
    }
    if (this.capture) {
      this.capture.samples.push(magnitude);
      if (this.capture.samples.length >= this.capture.count) {
        const { timestamp, samples } = this.capture;
        const split = Math.max(1, Math.floor(samples.length * 0.2));
        const rms = (arr: number[]) =>
          Math.sqrt(
            arr.reduce((sum, v) => sum + v * v, 0) / Math.max(1, arr.length),
          );
        const decayRatio =
          rms(samples.slice(Math.floor(samples.length * 0.6))) /
          Math.max(0.0001, rms(samples.slice(0, split)));
        this.onStrike?.({
          type: decayRatio > 0.25 ? "OPEN" : "CLOSED",
          confidence: 0.6,
          timestamp,
          peak: Math.max(...samples),
          decayRatio,
          zcr: 0,
        });
        this.capture = null;
      }
    } else if (
      magnitude > 0.4 &&
      magnitude > this.previousMagnitude * 1.35 &&
      now - this.lastStrikeTime > 90
    ) {
      this.lastStrikeTime = now;
      this.capture = {
        timestamp: now,
        samples: [magnitude],
        count: Math.max(8, Math.round(state.serialSampleRate * 0.04)),
      };
    }
    this.previousMagnitude = magnitude;
  }
}
export const serialManager = new SerialManager();
