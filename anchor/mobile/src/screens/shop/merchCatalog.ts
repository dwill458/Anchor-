export type MerchProductType = 'print' | 'phone-case' | 'desk-mat';
export type MerchLayoutOption = 'centered' | 'focus' | 'minimal';
export type MerchBackgroundOption = 'navy' | 'purple' | 'black';

export interface MerchProduct {
  type: MerchProductType;
  tabLabel: string;
  name: string;
  heroName: string;
  description: string;
  detailCopy: string;
  priceFrom: number;
  sizes: string[];
  colorsBySize: Record<string, string[]>;
  specs: string[];
}

export const MERCH_PRODUCTS: Record<MerchProductType, MerchProduct> = {
  'desk-mat': {
    type: 'desk-mat',
    tabLabel: 'Desk Mat',
    name: 'Anchor Desk Mat',
    heroName: 'ANCHOR DESK MAT',
    description: 'Keep your intention present where the work happens.',
    detailCopy:
      'A wide ritual surface for the place your attention keeps returning to. The anchor sits inside your daily field instead of waiting on a shelf.',
    priceFrom: 34,
    sizes: ['12x18', '12x22', '16x32'],
    colorsBySize: {
      '12x18': ['Black'],
      '12x22': ['Black'],
      '16x32': ['Black'],
    },
    specs: ['Soft fabric top', 'Anti-slip rubber base', 'Made to order'],
  },
  'phone-case': {
    type: 'phone-case',
    tabLabel: 'Phone Case',
    name: 'Anchor Phone Case',
    heroName: 'ANCHOR PHONE CASE',
    description: "A reminder you can't ignore.",
    detailCopy:
      'The anchor turns the object you reach for most into a quiet focal point. Built around the live Printful device catalog for supported iPhone and Galaxy models.',
    priceFrom: 28,
    sizes: [
      'iPhone 16',
      'iPhone 16 Pro',
      'iPhone 16 Pro Max',
      'iPhone 17',
      'iPhone 17 Pro',
      'Samsung Galaxy S25',
      'Samsung Galaxy S25 Ultra',
    ],
    colorsBySize: {
      default: ['Clear'],
    },
    specs: ['Gloss clear shell', 'Raised camera lip', 'Made to order'],
  },
  print: {
    type: 'print',
    tabLabel: 'Wall Print',
    name: 'Anchor Wall Print',
    heroName: 'ANCHOR WALL PRINT',
    description: 'Place it where focus begins.',
    detailCopy:
      'A framed focal point for the room that holds the work. The symbol stays calm, architectural, and visible from across the space.',
    priceFrom: 46,
    sizes: ['16x20"', '24x36"'],
    colorsBySize: {
      '16x20"': ['Black', 'White', 'Red Oak'],
      '24x36"': ['Black', 'White', 'Red Oak'],
    },
    specs: ['Matte print finish', 'Framed presentation', 'Made to order'],
  },
};

export const MERCH_PRODUCT_ORDER: MerchProductType[] = ['desk-mat', 'phone-case', 'print'];

export const MERCH_LAYOUT_OPTIONS: Array<{
  id: MerchLayoutOption;
  label: string;
  previewScale: number;
}> = [
  { id: 'centered', label: 'Centered', previewScale: 1 },
  { id: 'focus', label: 'Focus Point', previewScale: 0.94 },
  { id: 'minimal', label: 'Minimal Mark', previewScale: 0.58 },
];

export const MERCH_BACKGROUND_OPTIONS: Array<{
  id: MerchBackgroundOption;
  label: string;
  colors: [string, string];
}> = [
  { id: 'navy', label: 'Navy', colors: ['#120f1f', '#1b1630'] },
  { id: 'purple', label: 'Purple', colors: ['#241437', '#4a2d63'] },
  { id: 'black', label: 'Black', colors: ['#07090d', '#171a1f'] },
];

export function getMerchProduct(type: MerchProductType): MerchProduct {
  return MERCH_PRODUCTS[type];
}

export function getMerchAvailableColors(type: MerchProductType, size: string): string[] {
  const product = getMerchProduct(type);
  return product.colorsBySize[size] ?? product.colorsBySize.default ?? ['Black'];
}

export function calculateMerchSubtotal(type: MerchProductType, quantity: number): number {
  return getMerchProduct(type).priceFrom * Math.max(1, quantity);
}

export function formatMerchProductLabel(type: MerchProductType): string {
  return getMerchProduct(type).name;
}
