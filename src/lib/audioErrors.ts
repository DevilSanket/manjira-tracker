export function audioErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was blocked. Allow microphone access in your browser or system settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "The selected audio input is unavailable. Connect a microphone or choose another input.";
  if (name === "NotReadableError")
    return "The microphone is busy or unavailable. Close other apps using it and try again.";
  return error instanceof Error
    ? error.message
    : "Audio could not start. Check your input and try again.";
}
