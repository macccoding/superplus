export type MarginWarning = 'none' | 'low' | 'negative' | 'zero-cost';

export function calculateRetailPrice(cost: number, markupPercent: number) {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  if (!Number.isFinite(markupPercent)) return cost;
  return cost * (1 + markupPercent / 100);
}

export function calculateMarkupPercent(cost: number, retail: number) {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  if (!Number.isFinite(retail)) return 0;
  return ((retail - cost) / cost) * 100;
}

export function calculateGrossProfit(cost: number, retail: number) {
  if (!Number.isFinite(cost) || !Number.isFinite(retail)) return 0;
  return retail - cost;
}

export function roundRetailPrice(value: number, mode: 'cents' | 'nearest-dollar' | 'charm' = 'cents') {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (mode === 'nearest-dollar') return Math.round(value);
  if (mode === 'charm') {
    const whole = Math.ceil(value);
    return Math.max(0, whole - 0.01);
  }
  return Math.round(value * 100) / 100;
}

export function getMarginWarning(cost: number, retail: number, lowThreshold = 10): MarginWarning {
  if (!Number.isFinite(cost) || cost <= 0) return 'zero-cost';
  const markup = calculateMarkupPercent(cost, retail);
  if (markup < 0) return 'negative';
  if (markup < lowThreshold) return 'low';
  return 'none';
}

export function formatJmd(value: number) {
  if (!Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}
