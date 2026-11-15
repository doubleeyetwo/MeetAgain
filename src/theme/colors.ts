/* ---------- Design tokens from Figma ---------- */
export const colors = {
  bg: '#161120', // Main background gradient start.
  bgEnd: '#0d0a12', // Main background gradient end.
  white: '#f4f1f7', // Off-white used for text and SVG icons.
  purpleAccentGradientStart: '#b14cff',
  purpleAccentGradientEnd: '#8e00da',
  primaryAccent: '#7b3ff2',
  cardDarker: '#200c38', // Darker card surface for contrast against the background.
  fieldLabel: '#8cabff', // Small caption above a form field.
  linkAccent: '#9290ff', // Secondary action label, e.g. the calendar integration row.
  danger: '#ed1c1c', // Destructive actions. Named "Red" in the Figma variables.
  success: '#32a817', // Met requirement, filled strength segment.
  trackMuted: '#2e2936', // Unfilled track behind a progress or strength meter.
  cardLighter: '#35155d', // Lighter card surface for contrast against cardDarker.
  footer: '#17121f',
  headerFade: 'rgba(23, 18, 31, 0)', // Transparent end of the header gradient.
  red: '#ff3131', // Bright Neon red for deletions, exits, logouts, etc

  // Event planning heatmap. Green requires a continuous 30-minute shared opening.
  freeDay: {
    high: '#3CBE66', // At least 85% of the planning window is free together.
    medium: '#247349', // At least 60% and under 85% is free together.
    low: '#153D2D', // Under 60% is free together.
  },
} as const;

export const gradients = {
  background: [colors.bg, colors.bgEnd],
  purpleAccent: [colors.purpleAccentGradientStart, colors.purpleAccentGradientEnd],
  header: [colors.footer, colors.headerFade], // Solid at the top, fading to clear.
} as const;

// Spread these values onto LinearGradient to set its direction.
export const gradientDirection = {
  horizontal: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  vertical: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
} as const;
