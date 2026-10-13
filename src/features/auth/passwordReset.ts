import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/config/firebase';

const errorCode = (failure: unknown) =>
  failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;

export function validateResetEmail(input: string): { email?: string; error?: string } {
  const email = input.trim();

  if (!email) return { error: 'Enter your email address.' };
  if (email.length > 254) return { error: 'Enter a valid email address.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };

  return { email };
}

export async function requestPasswordReset(input: string): Promise<{ sent?: boolean; error?: string }> {
  const { email, error } = validateResetEmail(input);
  if (error || !email) return { error };

  try {
    await sendPasswordResetEmail(auth, email);
    return { sent: true };
  } catch (failure) {
    switch (errorCode(failure)) {
      case 'auth/invalid-email':
        return { error: 'Enter a valid email address.' };
      case 'auth/network-request-failed':
        return { error: 'Check your connection and try again.' };
      case 'auth/too-many-requests':
        return { error: 'Too many attempts. Wait a moment and try again.' };
      // Firebase's email enumeration protection normally reports success for unknown addresses. Treat the
      // code as sent anyway so a project with that protection disabled cannot be probed for registered emails.
      case 'auth/user-not-found':
        return { sent: true };
      default:
        return { error: 'Could not send the reset email. Please try again.' };
    }
  }
}

// Pulls the one-time code out of a pasted reset link, or accepts the bare code itself.
export function extractResetCode(input: string): string | undefined {
  const value = input.trim();
  let decoded = value;
  try {
    // Some email apps wrap links in a redirect that percent-encodes the original query string.
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed escapes: fall back to the raw text.
  }
  const match = /[?&]oobCode=([^&#\s]+)/.exec(decoded);
  if (match) return match[1];
  return /^[\w-]{10,}$/.test(value) ? value : undefined;
}

// Expired and invalid codes only come from checking or using a link, never from sending one.
function actionCodeError(code: unknown, fallback: string): string {
  switch (code) {
    case 'auth/expired-action-code':
      return 'This reset link has expired. Links only work for one hour, so request a new one.';
    case 'auth/invalid-action-code':
      return 'This reset link is invalid or was already used. Request a new one and use the newest email.';
    case 'auth/user-disabled':
      return 'This account is disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'The account for this link no longer exists.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Choose a stronger password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Check your connection and try again.';
    default:
      return fallback;
  }
}

export async function checkResetLink(input: string): Promise<{ code?: string; email?: string; error?: string }> {
  const code = extractResetCode(input);
  if (!code) return { error: 'Paste the full link from your reset email.' };

  try {
    // Checking a code does not use it up; only confirmPasswordReset does.
    const email = await verifyPasswordResetCode(auth, code);
    return { code, email };
  } catch (failure) {
    return { error: actionCodeError(errorCode(failure), 'Could not check this link. Please try again.') };
  }
}

export async function completePasswordReset(
  code: string,
  newPassword: string,
): Promise<{ done?: boolean; error?: string; linkUnusable?: boolean }> {
  try {
    await confirmPasswordReset(auth, code, newPassword);
    return { done: true };
  } catch (failure) {
    const failureCode = errorCode(failure);
    return {
      error: actionCodeError(failureCode, 'Could not update your password. Please try again.'),
      // The link can expire between checking it and saving, so the screen asks for a fresh one.
      linkUnusable: failureCode === 'auth/expired-action-code' || failureCode === 'auth/invalid-action-code',
    };
  }
}
