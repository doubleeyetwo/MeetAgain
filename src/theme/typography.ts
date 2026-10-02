/* ---------- Design tokens from Figma ---------- */
export const fontFamily = {
    regular: 'Moderustic_400Regular',
    semibold: 'Moderustic_600SemiBold',
} as const;

/* NOTE: If one of these doesn;t fit the figma, use the text size used on Figma or to your own discretion */
/* ---------- Text ---------- */
export const text = {
  title: { fontFamily: fontFamily.semibold, fontSize: 24 },     // page titles, names
  header: { fontFamily: fontFamily.semibold, fontSize: 18 },    // category headers
  body: { fontFamily: fontFamily.regular, fontSize: 14 },       // standard text
} as const;