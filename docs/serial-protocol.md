# USB serial protocol

Use 115200 baud and newline-delimited UTF-8 text. Firmware and a compatible USB controller are required; connecting a board does not automatically install ADC firmware.

## Preferred: classified strikes

Send one line per physical strike:

```text
OPEN,92,3450
CLOSED,85,1800
```

The type must be exactly `OPEN` or `CLOSED` (case insensitive). Confidence is optional, in the range 0–100. Peak frequency is optional, in the range 0–24000 Hz. Extra fields, partial numeric values, and invalid confidence values are ignored. Tagged strikes have a 90 ms debounce interval. Host arrival time is used for timing because this protocol has no synchronized device clock; USB delay must be measured on the actual device.

## Experimental: raw ADC readings

Send one integer reading per line, sampled at the configured rate:

```text
2048
2055
2840
```

Select **12 bit** for 0–4095, or **10 bit** for 0–1023. The bipolar midpoint is 2048 or 512 respectively. Select the firmware's sample rate before connecting. The UI supports 200–2000 samples per second, within the practical throughput of this text protocol at 115200 baud. Do not send raw readings at audio sample rates such as 48 kHz over this connection.

Raw classification compares the first and last portions of a 40 ms capture after a transient. It is not the microphone FFT classifier and should be treated as experimental. Frequency is not fabricated for raw readings. Verify both strike types against real recordings before using this mode for scored practice.

Malformed lines are ignored, incomplete line buffers are bounded, clipping indicators recover, and disconnects stop listening. Reconnect after selecting another resolution or sample rate.
