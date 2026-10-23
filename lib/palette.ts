/**
 * Chart colors are CSS custom properties (defined in app/globals.css with
 * separate light and dark steps), so components reference roles, not hex.
 *
 * Slots 0–7 are an 8-hue categorical palette validated for colorblind
 * separation in fixed adjacent order. Slots 8+ are neutral grays: "Other"
 * uses the first, and any custom classes beyond the eight hues share the
 * rest rather than generating new hues. Legends and tables always label them.
 */
export const CATEGORICAL_SLOTS = 8;
const NEUTRAL_SLOTS = 4;

export function seriesColor(colorIndex: number): string {
  if (colorIndex < CATEGORICAL_SLOTS) return `var(--series-${colorIndex + 1})`;
  return `var(--series-neutral-${((colorIndex - CATEGORICAL_SLOTS) % NEUTRAL_SLOTS) + 1})`;
}
