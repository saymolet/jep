/** BUZZ_HAPTIC is a short tick when a buzz is sent. */
export const BUZZ_HAPTIC = 20;

/** LOCKOUT_HAPTIC is a double buzz when a player buzzes too early. */
export const LOCKOUT_HAPTIC = [60, 50, 60];

/** vibrate runs a vibration pattern where the Vibration API exists (Android
 * browsers; not iOS Safari or desktops). Returns whether it vibrated. Never
 * throws: haptics are a nice-to-have. */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
