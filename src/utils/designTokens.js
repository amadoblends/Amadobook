// AmadoBook Premium Design System v2
// Aesthetic: Luxury Dark / Editorial — Monda mono-feel + bold hierarchy
export const T = {
  // Core backgrounds — pure black system
  bg:         '#070707',
  bgCard:     '#0F0F0F',
  bgRaised:   '#151515',
  bgInput:    '#111111',
  bgHover:    '#1A1A1A',
  bgActive:   '#1F1F1F',

  // Borders — barely visible, structural
  border:     '#1C1C1C',
  borderMid:  '#272727',
  borderHigh: '#333333',

  // Typography
  textPri:    '#F5F5F5',
  textSec:    '#777777',
  textTert:   '#3A3A3A',
  textInv:    '#080808',   // text on yellow bg

  // Brand yellow — IMDb-gold, premium
  yellow:     '#F5C518',
  yellowDim:  'rgba(245,197,24,0.10)',
  yellowMid:  'rgba(245,197,24,0.22)',
  yellowGlow: '0 0 28px rgba(245,197,24,0.28)',
  yellowText: '#F5C518',

  // Semantic
  green:      '#22C55E',
  greenDim:   'rgba(34,197,94,0.12)',
  red:        '#F43F5E',
  redDim:     'rgba(244,63,94,0.12)',
  blue:       '#3B82F6',
  blueDim:    'rgba(59,130,246,0.12)',

  // Type
  font:       "'Monda', 'JetBrains Mono', monospace",
  fontSans:   "'Monda', system-ui, sans-serif",

  // Radii
  r8: '8px', r12: '12px', r16: '16px', r20: '20px', r24: '24px',

  // Elevation
  shadow:     '0 1px 4px rgba(0,0,0,0.7)',
  shadowMd:   '0 4px 20px rgba(0,0,0,0.8)',
  shadowLg:   '0 12px 40px rgba(0,0,0,0.9)',
}

export const statusColor = (status) => ({
  pending:   T.yellow,
  confirmed: T.green,
  completed: T.blue,
  cancelled: T.red,
}[status] || T.textSec)
