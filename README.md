# MeetAgain

Expo + React Native + TypeScript foundation for coordinating events with friends.

## Run with Expo Go

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Firebase web-app configuration.
3. Start Metro with `npm start` and scan the QR code in Expo Go.
4. Run `npm run typecheck` before committing.

## Structure

- `src/config`: Firebase initialization and environment-backed configuration.
- `src/features`: feature-owned screens and future hooks/services (`auth`, `events`, `friends`, `home`, `notifications`, `profile`).
- `src/navigation`: auth stack, bottom tabs, and app stack.
- `src/types`: shared Firestore/domain models.
- `src/data`: collection names and future repositories.
- `firestore.rules`: intentionally locked starter rules; open these only as authenticated rules are implemented.

Google OAuth and Calendar Freebusy should be added behind feature services rather than directly inside screens. Local calendar access is intentionally left as a later stretch goal.






FILE SETUP
# Check that Node.js and npm are installed
node --version
npm --version

# Install all project dependencies after cloning the repo
npm install

# Install Firebase
npm install firebase

# Install AsyncStorage for Firebase Auth persistence with Expo
npx expo install @react-native-async-storage/async-storage

# Start the Expo development server
npx expo start