# MeetAgain code walkthrough

## Start here

`App.tsx` loads the fonts, provides shared authentication state, and chooses which navigator to show. While authentication is loading, it shows a spinner. A user admitted by `AuthContext` sees the main app; otherwise, they see the authentication screens.

`src/navigation/AuthNavigator.tsx` registers the signup and sign-in screens. `AppNavigator.tsx` registers the main tabs and event screens. `types.ts` describes the route names and parameters so TypeScript can catch navigation mistakes.

## Signup, step by step

1. **RegisterScreen** collects and validates the email, then passes it to the Password screen.
2. **PasswordScreen** checks the password length and saves the email/password draft in `AuthContext`. It opens Create Profile without creating a Firebase account yet.
3. **CreateProfileScreen** collects names, username, birthday, and an optional photo. It handles the form and calls `validateProfile` before submitting.
4. **AuthContext.createAccount** creates the Firebase Authentication account when the user presses Join. It then saves the completed profile and reserves the username together in a Firestore transaction.
5. After the save succeeds, the context exposes the user to `App.tsx`, which switches to the main app.

The password draft lives only in memory. It does not go into Firestore, persistent local storage, or navigation parameters. Closing the app loses the draft.

## Authentication and Firestore have different jobs

Firebase Authentication checks credentials and supplies a unique user ID (`uid`). Firestore stores app-specific profile information in `users/{uid}`. Password verification belongs to Authentication; the app never reads a password from Firestore.

SignInScreen calls Firebase's email/password sign-in method. AuthContext listens for authentication changes and checks for the user's Firestore profile before allowing the main app to open. The Profile tab calls Firebase sign-out; the same listener returns the app to the authentication screens.

Older accounts with an existing profile document remain usable even if that document predates the `profileComplete` field.

## Why signup needs a transaction and retry handling

Two people could choose the same username at the same time. A Firestore transaction checks `usernames/{username}` and writes both the reservation and `users/{uid}` together. The rules also require those documents to match. This makes username ownership a database decision instead of a check performed only by the form.

Firebase Authentication and Firestore are separate services, so creating an account and saving its profile cannot happen in one Firestore transaction. If account creation succeeds but the profile save fails, the app keeps that account pending and allows another save attempt with the same user ID. It only opens Home after the profile is saved. After restarting or signing in, a missing profile sends the user back to profile setup. A failed profile lookup also keeps the user in setup rather than admitting them without a successful lookup.

The context uses refs to prevent duplicate submissions and to ignore stale asynchronous authentication results. State values trigger visible updates; refs hold internal values without causing a render.

## Validation and photos

`profileValidation.ts` trims names, normalizes usernames to lowercase, validates their format, and checks birthdays. The form accepts `MM/DD/YYYY`; the saved birthday uses `YYYY-MM-DD`.

The photo flow opens the image picker or camera, resizes the selected image, and converts it to a compressed JPEG data URL. The profile document stores that small string. The size limit must agree with `firestore.rules`. This approach supports the current prototype; a future change to dedicated image storage should stay behind the profile/photo logic rather than spread through other screens.

## Adding the next feature

Keep a feature's screens and business logic in its own `src/features` folder. Screens describe what the user sees and how input is collected. Validation functions describe acceptable input. Service functions can handle database operations as a feature grows. Shared types describe data and shared theme values keep screens consistent.

Firestore rules are part of a feature too: a new screen does not automatically gain permission to read or write a new collection. The current rules allow the signup operations and deny unspecified access. Changes to rules must be published separately in Firebase.

For a manual check, create a profile, sign out, sign in with the correct credentials, then try an incorrect password. Also try a duplicate username and retry with a different one. Verify photos and camera permissions on the iPhone. Type checking alone does not exercise those flows.
