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

# Step by Step Setup
1. Make sure you have npm on pc and Expo Go on your phone
2. Open project from GitHub onto IDE
3. Check if npm is installed with *npm --version*
4. Run *npm install --cache .npm-cache*
5. Use the .env.example to create your own .env file (DO NOT PUSH THIS TO THE REPO the .gitignore should already do that for you)
6. To find you API keys go to Settings --> General and scroll down and itll have a block of code for you to copy from and fill in the keys accordingly (anything in the .env.example not listed on firebase is likely not needed so just leave it blank)
7. For Expo Go, make an account and on the computer at expo.dev set a "password" in the user settings, this password will be used in console to connect the code to the Expo Go app
8. Go to the Firebase console and go to Settings --> General --> View on Google Cloud --> APIs and Services --> Credentials --> Find OAuth IDs and find "MeetAgain OAuth" from there scroll down and find Authorized redirect URIs and put https://auth.expo.io/%YOUR_USERNAME%/meetagain and hit save
9. Type *npm install firebase* into your console
10. Type *npm expo-doctor* and all checks should pass if youve done everything correctly
11. Type *npx expo login*
12. That "password" from earlier is used here along with your Expo Go user name
13. Type *npx expo start* and scan the QR code and you're done!