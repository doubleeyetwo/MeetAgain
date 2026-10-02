/* ---------- Design tokens from Figma ---------- */
export const colors = {
  bg: '#161120',                        // Main BG (start)
  bgEnd: '#0d0a12',                     // Main BG (end)
  white: '#f4f1f7',                     // Off white: text and icon SVGs
  purpleAccentGradientStart: '#b14cff', // Purple Accent (start)
  purpleAccentGradientEnd: '#8e00da',   // Purple Accent (end)
  primaryAccent: '#7b3ff2',             // Used for things like dividers and other small accents
  cardDarker: '#200c38',                // Cards/buttons needing contrast against bg
  cardLighter: '#35155d',               // Cards/buttons needing contrast against cardDarker
  footer: '#17121f',                    // Footer color for nav bar
  headerFade: 'rgba(23, 18, 31, 0)',    // #17121F at 0 alpha (see notes on gradient)

  // Free Day Colors: Lighter Green = More Available
  freeDay: {
    high: '#3cbe66',
    medium: '#2e8e56',
    low: '#1d5941',
  }
} as const;

export const gradients = {
    background: [colors.bg, colors.bgEnd],
    purpleAccent: [colors.purpleAccentGradientStart, colors.purpleAccentGradientEnd],
    header: [colors.footer, colors.headerFade], // Solid at top then fades to clear
} as const;

// Spread these onto <LinearGradient> to set direction
export const gradientDirection = {
  horizontal: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  vertical: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
} as const;