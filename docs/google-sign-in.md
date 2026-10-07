# Google sign-in on Expo web

The registration and sign-in buttons use Firebase Authentication's Google popup. Firebase signs the user into the same Auth session used by email/password. A new Google account gets a minimal `users/{uid}` document with `profileComplete: false`, then finishes name, username, and date of birth on Create Profile. The username claim and completed profile are saved together. Returning users with completed profiles open Home.

## Firebase setup

1. Copy `.env.example` to `.env` and fill the `EXPO_PUBLIC_FIREBASE_*` values from the Firebase project's web app configuration. Restart Expo after changing them. These are public client configuration values, never a Google client secret.
2. In Firebase Console → Authentication → Sign-in method, enable **Google** and select the project support email.
3. In Authentication → Settings → Authorized domains, add the exact domain used to serve Expo web, including `localhost` for local testing and any deployed domain. Domain entries have no scheme or port.
4. Publish this repository's `firestore.rules` to the same Firebase project. The new pending profile creation and completion transaction depend on those rules.

The web popup does not use Expo Go or the `auth.expo.io` redirect. The Firebase web app configuration supplies the OAuth client used by Firebase. Google sign-in on native Expo Go currently shows a web-only message.

## Test locally

Run `npm run web`, open the local address Expo prints, and try **Continue with Google** from registration and **Sign in with Google** from Sign In. For a new Google account, verify the profile form appears and Home stays closed until **Join MeetAgain** saves a unique username. Sign out and sign in again to verify the completed account opens Home. Reload while a profile is incomplete to verify setup resumes; close the popup or disconnect the network to check the inline error.

Run `node --test tests/auth-context.test.cjs` and `npm run typecheck` for local checks. The auth context tests cover the pending profile, completion, restored sessions, and returning Google users.
