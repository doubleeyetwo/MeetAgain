export function googleSignInError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This web address is not authorized in Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Authentication.';
    case 'auth/internal-error':
      return 'Google sign-in hit an internal error. Reload the browser and try again.';
    case 'permission-denied':
      return 'Your profile could not be saved because Firestore rules denied the write. Check the published rules and try again.';
    default:
      return typeof code === 'string' && /^[a-z0-9_/-]+$/i.test(code)
        ? `Could not sign in with Google (${code}). Please try again.`
        : 'Could not sign in with Google. Please try again.';
  }
}
