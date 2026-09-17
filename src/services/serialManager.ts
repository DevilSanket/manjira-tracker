/**
 * Texas Instruments (TI) & Microcontroller Serial Hardware Manager
 * Reads digital vibration transducer telemetry via Web Serial API (navigator.serial).
 */
import { useAppStore } from '../store/useAppStore';

export class SerialManager {
  private port: any = null;
  private reader: any = null;
  private keepReading: boolean = false;
  private buffer: number[] = [];
  private onStrikeCallback: ((data: any) => void) | null = null;
  private lastStrikeTime: number = 0;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async connect(baudRate: number = 115200): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome, Edge, or the Desktop App.');
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate });

      const store = useAppStore.getState();
      const info = this.port.getInfo ? this.port.getInfo() : {};
      const portLabel = info.usbVendorId ? `TI USB (VID:${info.usbVendorId.toString(16)})` : 'TI Serial COM';
      store.setSerialConnected(true, portLabel);

      this.keepReading = true;
      this.readLoop();
      return true;
    } catch (err) {
      console.error('SerialManager: Connection failed', err);
      this.disconnect();
      throw err;
    }
  }

  async disconnect() {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {
        // ignore
      }
      this.reader = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {
        // ignore
      }
      this.port = null;
    }

    useAppStore.getState().setSerialConnected(false, '');
  }

  setStrikeCallback(cb: (data: any) => void) {
    this.onStrikeCallback = cb;
  }

  private async readLoop() {
    if (!this.port || !this.port.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      this.reader = reader;

      let lineBuffer = '';

      while (this.keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
              this.handleSerialLine(trimmed);
            }
          }
        }
      }

      await readableStreamClosed.catch(() => {});
    } catch (err) {
      if (this.keepReading) {
        console.error('SerialManager: read error', err);
      }
    } finally {
      this.disconnect();
    }
  }

  /**
   * Parses telemetry lines from the TI board.
   * Supports both raw ADC values and pre-classified protocol tags:
   * e.g. "OPEN,92,3450", "CLOSED,85,1200", or raw numerical ADC voltages "2840"
   */
  private handleSerialLine(line: string) {
    const now = Date.now();
    const upper = line.toUpperCase();

    // Protocol format: TYPE,CONFIDENCE,PEAK_FREQ (e.g., "OPEN,90,3400")
    if (upper.startsWith('OPEN') || upper.startsWith('CLOSED')) {
      if (now - this.lastStrikeTime < 90) return;
      this.lastStrikeTime = now;

      const parts = line.split(/[,: ]+/);
      const type = parts[0].toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED';
      const conf = parts[1] ? parseFloat(parts[1]) / 100 : 0.92;
      const freq = parts[2] ? parseFloat(parts[2]) : (type === 'OPEN' ? 3500 : 1800);

      if (this.onStrikeCallback) {
        this.onStrikeCallback({
          type,
          confidence: conf,
          peak: 0.85,
          zcr: type === 'OPEN' ? 0.32 : 0.14,
          decayRatio: type === 'OPEN' ? 0.45 : 0.05,
          peakFreq: freq,
          peakProminence: type === 'OPEN' ? 14.5 : 5.0
        });
      }
      return;
    }

    // Numerical ADC stream: e.g. raw vibration sample
    const num = parseFloat(line);
    if (!isNaN(num)) {
      // Normalize assuming 10-bit (0..1023) or 12-bit (0..4095) or float (-1..1)
      let normalized = num;
      if (num > 2000) normalized = (num - 2048) / 2048;
      else if (num > 500) normalized = (num - 512) / 512;

      this.buffer.push(Math.abs(normalized));
      if (this.buffer.length > 200) this.buffer.shift();

      // Check peak clipping threshold
      if (Math.abs(normalized) >= 0.95) {
        useAppStore.getState().setIsClipping(true);
      }

      // Simple transient onset detection from raw ADC
      if (this.buffer.length >= 20 && Math.abs(normalized) > 0.40) {
        if (now - this.lastStrikeTime > 100) {
          this.lastStrikeTime = now;
          // Analyze decay over previous vs current samples
          const recent = this.buffer.slice(-10);
          const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
          const isOpen = avgRecent > 0.18; // Sustained vibration vs rapid drop

          if (this.onStrikeCallback) {
            this.onStrikeCallback({
              type: isOpen ? 'OPEN' : 'CLOSED',
              confidence: 0.88,
              peak: Math.min(1.0, Math.abs(normalized)),
              zcr: isOpen ? 0.28 : 0.12,
              decayRatio: isOpen ? 0.38 : 0.06,
              peakFreq: isOpen ? 3400 : 2100,
              peakProminence: isOpen ? 12 : 6
            });
          }
        }
      }
    }
  }
}

export const serialManager = new SerialManager();
