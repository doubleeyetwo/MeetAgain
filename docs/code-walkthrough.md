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

## Password reset

<<<<<<< Updated upstream
The sign-in screen's "Forgot Password?" link opens **ForgotPasswordScreen** and fills in any email the user already typed. The screen checks the email format first, so a malformed address shows an error without contacting Firebase. A valid address goes to Firebase's `sendPasswordResetEmail`, and Firebase error codes become readable messages. After a successful send, **ResetPasswordSentScreen** replaces the form and links back to sign-in.

The emailed link opens a page hosted by Firebase, not by the app. The user chooses a new password there; afterwards the old password fails at sign-in and the new one works. Firebase's email enumeration protection (on by default for newer projects) reports success even for unregistered addresses, so the confirmation screen says "if an account exists" and the "no account" message appears only if that protection is turned off.
=======
**ForgotPasswordScreen** calls `requestPasswordReset` in `passwordReset.ts`, which validates the email and asks Firebase to send a reset link. Sending a link can fail only for request-level reasons (bad email, network, rate limit). It never reports an expired or used link.

Tapping the emailed link opens a page hosted by Firebase, not by the app. If that page says the link "has expired or has already been used", the app never sees why. Each link works once and expires after one hour. Opening an older email in the same thread is the usual cause: Gmail groups reset emails into one thread and can hide the newest link behind "show trimmed content".

**ResetPasswordScreen** ("Already have a reset link?") finishes the reset inside the app instead. The user pastes the link; `checkResetLink` extracts its one-time code and calls `verifyPasswordResetCode`, which checks the code without using it up. `completePasswordReset` then calls `confirmPasswordReset` with the new password. Both map `auth/expired-action-code` and `auth/invalid-action-code` to separate messages, and a link that expires between the two steps sends the user back to paste a fresh one. The code stays in screen state only, because anyone holding a live code can set the account's password.
>>>>>>> Stashed changes

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

For a manual check, create a profile, sign out, sign in with the correct credentials, then try an incorrect password. Also try a duplicate username and retry with a different one. For password reset, submit a malformed email (an error appears and nothing is sent), then request a reset for your account, set a new password from the email link, and confirm only the new password signs in. Verify photos and camera permissions on the iPhone. Type checking alone does not exercise those flows.
