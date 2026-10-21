export function splitGoogleDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function isGooglePhotoURL(url: string): boolean {
  return /^https:\/\/lh[0-9]+\.googleusercontent\.com\//.test(url) && url.length <= 2048;
}

export function hasCompletedProfile(profile: { profileComplete?: boolean } | null): boolean {
  // Old profiles predate the flag, but a document explicitly marked unfinished
  // must stay in setup.
  return profile !== null && profile.profileComplete !== false;
}

export function profilePhotoFields(photo?: { dataUrl: string } | { photoURL: string }) {
  if (!photo) return {};
  return 'dataUrl' in photo ? { photoDataUrl: photo.dataUrl } : { photoURL: photo.photoURL };
}
