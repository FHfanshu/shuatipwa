export type ColorPalette = 'copper' | 'ocean' | 'forest' | 'lavender' | 'rose' | 'slate';

export const PALETTE_LABELS: Record<ColorPalette, string> = {
  copper: '琥珀',
  ocean: '海洋',
  forest: '森林',
  lavender: '薰衣草',
  rose: '玫瑰',
  slate: '石板',
};

export const PALETTE_PREVIEW: Record<ColorPalette, { light: string; accent: string; dark: string; darkAccent: string }> = {
  copper: { light: '#faf8f5', accent: '#b87333', dark: '#0f0e0c', darkAccent: '#d4956a' },
  ocean:  { light: '#f5f8fc', accent: '#2563eb', dark: '#0a0f1a', darkAccent: '#60a5fa' },
  forest: { light: '#f5faf6', accent: '#1a7a4c', dark: '#0a120e', darkAccent: '#5cc88a' },
  lavender: { light: '#f8f5fc', accent: '#7c3aed', dark: '#0e0a14', darkAccent: '#a78bfa' },
  rose:   { light: '#fcf5f7', accent: '#d94070', dark: '#140a0e', darkAccent: '#f472b6' },
  slate:  { light: '#f6f7f9', accent: '#475569', dark: '#0c0d10', darkAccent: '#94a3b8' },
};
