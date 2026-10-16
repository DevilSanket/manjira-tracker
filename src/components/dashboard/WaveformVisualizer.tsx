import { useEffect, useRef } from "react";
import { audioManager } from "../../features/audio/AudioManager";
import { useAppStore } from "../../store/useAppStore";
export function WaveformVisualizer({ dark = false }: { dark?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { audioStatus, inputMode } = useAppStore();
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let frame = 0;
    let values = new Float32Array(1024);
    const draw = () => {
      const width = element.width,
        height = element.height;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = dark ? "#314356" : "#e1e6ed";
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const analyser = audioManager.getAnalyser();
      if (analyser && audioStatus === "ready" && inputMode === "microphone") {
        if (values.length !== analyser.fftSize)
          values = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(values);
      } else values.fill(0);
      ctx.strokeStyle = dark ? "#ebc675" : "#9b6814";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * width,
          y = height / 2 - values[i] * height * 0.46;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [audioStatus, inputMode, dark]);
  return (
    <canvas
      ref={canvas}
      className="waveform"
      width="900"
      height="180"
      role="img"
      aria-label={
        audioStatus === "ready"
          ? "Live microphone waveform"
          : "Microphone waveform, input idle"
      }
    />
  );
}
