import { seriesColor } from "@/lib/palette";

export function Swatch({ colorIndex, className = "" }: { colorIndex: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: seriesColor(colorIndex) }}
    />
  );
}
