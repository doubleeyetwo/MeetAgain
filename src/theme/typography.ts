/* ---------- Design tokens from Figma ---------- */
export const fontFamily = {
  regular: 'Moderustic_400Regular',
  semibold: 'Moderustic_600SemiBold',
} as const;

/* Text styles for page titles, section headers, and body copy. */
export const text = {
  title: { fontFamily: fontFamily.semibold, fontSize: 24 },
  header: { fontFamily: fontFamily.semibold, fontSize: 18 },
  body: { fontFamily: fontFamily.regular, fontSize: 14 },
} as const;
