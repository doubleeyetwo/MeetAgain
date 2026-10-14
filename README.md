# MeetAgain

Expo + React Native + TypeScript foundation for coordinating events with friends.

## Structure

- `src/config`: Firebase initialization and environment-backed configuration.
- `src/features`: feature-owned screens and future hooks/services (`auth`, `events`, `friends`, `home`, `notifications`, `profile`).
- `src/navigation`: auth stack, bottom tabs, and app stack.
- `src/types`: shared Firestore/domain models.
- `src/data`: collection names and future repositories.
- `src/themes`: this is where our design tokens are standardized and used across the whole app.
- `firestore.rules`: authenticated profile, username directory, and friendship access rules.

## Friends and Firestore rules

Profile friend totals and the required backend deployment/backfill are documented
in [Friend counts](docs/friend-counts.md).

The Profile tab opens Friends. Search uses an exact username and reads the
public `usernames/{username}` document, which contains only a UID and display
name. Private `users/{uid}` profiles remain owner-only. A request, decline, or
accepted friendship uses one `friendships/{smallerUid}_{largerUid}` document;
only its participants can list it, and only the recipient can answer a pending
request. The original sender can retry after a decline.

Existing accounts gain a public display name on their username record when
they next sign in with the updated app. Until then, friend search and lists
show their username as a fallback. The updated Firestore rules must be
published before the new friend actions can work in the live app.

Google sign-in uses `src/features/auth/googleAuth.ts`; Calendar Freebusy remains future work. Local calendar access is intentionally left as a later stretch goal.

## Google sign-in setup

Enable Google as a sign-in provider in Firebase Authentication. Create OAuth
clients for web, iOS, and Android, then put their public client IDs in the
matching `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` fields in `.env` (see `.env.example`).
The iOS client must match `com.fivestack.meetagain`; the Android client must
match `com.meetagain.app` and the signing certificate fingerprint used for the
build. Configure the web client's authorized origin for the URL where the app
runs. Keep client secrets out of `.env` and the app bundle.

Google sign-in on iOS and Android requires a development or production build
(`npm run ios:native` or `npm run android:native`); it is disabled in Expo Go.
Email/password sign-in remains available in Expo Go. The Google button is also
disabled on a platform until its client ID is configured. A new Google user
must complete the same profile setup as an email/password user before entering
the app. OAuth configuration and sign-in still need to be checked with real
credentials on each target platform.

FILE SETUP
### Check that Node.js and npm are installed
node --version
npm --version

### Install all project dependencies after cloning the repo
npm install

### Start the Expo development server
npx expo start

# Step by Step Setup
1. Make sure you have npm on pc and Expo Go on your phone
2. Open project from GitHub onto IDE
3. Check if npm is installed with *npm --version*
4. Run *npm install --cache .npm-cache*
5. Use the .env.example to create your own .env file (DO NOT PUSH THIS TO THE REPO the .gitignore should already do that for you)
6. To find you API keys go to Settings --> General and scroll down and itll have a block of code for you to copy from and fill in the keys accordingly (anything in the .env.example not listed on firebase is likely not needed so just leave it blank)
7. For Expo Go, make an account and on the computer at expo.dev set a "password" in the user settings, this password will be used in console to connect the code to the Expo Go app
8. For Google sign-in, use the platform-specific OAuth setup above.
9. Type *npm install firebase* into your console
10. Type *npm expo-doctor* and all checks should pass if youve done everything correctly
11. Type *npx expo login*
12. That "password" from earlier is used here along with your Expo Go user name
13. Type *npx expo start* and scan the QR code and you're done!
14. Type *npx expo install @react-native-async-storage/async-storage* for async storage so settings persist through different sessions
