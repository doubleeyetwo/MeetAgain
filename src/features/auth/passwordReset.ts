import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';

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
    const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;
    switch (code) {
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
