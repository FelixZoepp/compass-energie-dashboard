// Sequentielle Blau-Rampe (eine Farbe, hell → dunkel) für Heatmap und Kohorten.
const RAMPE = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];

/** Hintergrund + Textfarbe für einen Anteil 0..1 relativ zum Maximum. */
export function sequenz(wert: number | null, max = 1, min = 0): { background: string; color: string } | undefined {
  if (wert == null || !Number.isFinite(wert)) return undefined;
  // Spannweite min..max auf die Rampe legen (unterste Stufe bleibt sichtbar)
  const x = Math.max(0, Math.min(1, max > min ? (wert - min) / (max - min) : 1)) * 0.85 + 0.05;
  const i = Math.round(x * (RAMPE.length - 1));
  return { background: RAMPE[i], color: i >= 7 ? "#ffffff" : "#0b0b0b" };
}
