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
  cardLighter: '#35155d', // Lighter card surface for contrast against cardDarker.
  footer: '#17121f',
  headerFade: 'rgba(23, 18, 31, 0)', // Transparent end of the header gradient.

  // Lighter green indicates more available time.
  freeDay: {
    high: '#3cbe66',
    medium: '#2e8e56',
    low: '#1d5941',
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
