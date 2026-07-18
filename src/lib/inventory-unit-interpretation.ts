export type StockInterpretationMode = 'raw' | 'as_grams' | 'as_pounds' | 'packages_from_grams';

export interface StockInterpretationInput {
  description: string | null | undefined;
  systemStock: number | null | undefined;
  unit: string | null | undefined;
  needsReview?: boolean | null;
}

export interface StockInterpretation {
  mode: StockInterpretationMode;
  label: string;
  value: string;
  detail: string;
  presentationLabel: string | null;
  isAmbiguous: boolean;
  isSuspicious: boolean;
}

const GRAMS_PER_LB = 453.59237;
const LBS_PER_ARROBA = 25;
const GRAMS_PER_ARROBA = GRAMS_PER_LB * LBS_PER_ARROBA;

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}

function parseNumericToken(token: string): number {
  const raw = token.trim();
  if (raw.includes('.') && !raw.includes(',')) {
    const parts = raw.split('.');
    const last = parts[parts.length - 1];
    if (last.length === 3) return Number(parts.join(''));
  }
  return Number(raw.replace(',', '.'));
}

export function detectPresentationGrams(description: string | null | undefined): number | null {
  const text = normalizeText(description);

  const kg = text.match(/X\s*(\d+(?:[.,]\d+)?)\s*K(?:G|ILO|ILOS)\b/);
  if (kg) return parseNumericToken(kg[1]) * 1000;

  const grams = text.match(/X\s*(\d+(?:[.,]\d+)?)\s*(?:G|GR|GRAMOS?)\b/);
  if (grams) return parseNumericToken(grams[1]);

  if (/\bX\s*LB\b|\bX\s*LIBRA\b/.test(text)) return GRAMS_PER_LB;

  return null;
}

export function formatPresentation(grams: number | null): string | null {
  if (!grams || !Number.isFinite(grams)) return null;
  if (Math.abs(grams - GRAMS_PER_LB) < 0.01) return '1 libra';
  if (grams >= 1000) return `${formatNumber(grams / 1000, 2)} kg`;
  return `${formatNumber(grams, 0)} g`;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

export function getStockInterpretation(
  input: StockInterpretationInput,
  mode: StockInterpretationMode
): StockInterpretation {
  const stock = Number(input.systemStock) || 0;
  const unit = input.unit || 'Unidad ERP';
  const presentationGrams = detectPresentationGrams(input.description);
  const presentationLabel = formatPresentation(presentationGrams);
  const isSuspicious = Boolean(input.needsReview) || Math.abs(stock) > 100000;
  const isAmbiguous = unit.toLowerCase().includes('unidad') && Boolean(presentationGrams || isSuspicious);

  if (mode === 'as_grams') {
    const pounds = stock / GRAMS_PER_LB;
    const arrobas = stock / GRAMS_PER_ARROBA;
    const packages = presentationGrams ? stock / presentationGrams : null;

    return {
      mode,
      label: 'Si crudo = gramos',
      value: `${formatNumber(pounds, 2)} lb / ${formatNumber(arrobas, 2)} arrobas`,
      detail: packages !== null && presentationLabel
        ? `${formatNumber(packages, 2)} paquetes de ${presentationLabel}`
        : 'Sin presentacion detectable',
      presentationLabel,
      isAmbiguous,
      isSuspicious,
    };
  }

  if (mode === 'as_pounds') {
    const arrobas = stock / LBS_PER_ARROBA;
    return {
      mode,
      label: 'Si crudo = libras',
      value: `${formatNumber(arrobas, 2)} arrobas`,
      detail: `${formatNumber(stock, 2)} lb interpretadas`,
      presentationLabel,
      isAmbiguous,
      isSuspicious,
    };
  }

  if (mode === 'packages_from_grams') {
    if (!presentationGrams || !presentationLabel) {
      return {
        mode,
        label: 'Paquetes',
        value: 'No calculable',
        detail: 'La descripcion no trae presentacion clara',
        presentationLabel,
        isAmbiguous,
        isSuspicious,
      };
    }

    return {
      mode,
      label: 'Paquetes si crudo = gramos',
      value: `${formatNumber(stock / presentationGrams, 2)} paquetes`,
      detail: `Presentacion detectada: ${presentationLabel}`,
      presentationLabel,
      isAmbiguous,
      isSuspicious,
    };
  }

  return {
    mode: 'raw',
    label: 'Dato ERP',
    value: `${formatNumber(stock, 4)} ${unit}`,
    detail: presentationLabel ? `Presentacion detectada: ${presentationLabel}` : 'Sin conversion aplicada',
    presentationLabel,
    isAmbiguous,
    isSuspicious,
  };
}
