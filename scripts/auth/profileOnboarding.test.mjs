import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasCompletedProfile,
  isGooglePhotoURL,
  profilePhotoFields,
  splitGoogleDisplayName,
} from '../../src/features/auth/profileOnboarding.ts';

test('new and explicitly unfinished accounts stay in profile setup', () => {
  assert.equal(hasCompletedProfile(null), false);
  assert.equal(hasCompletedProfile({ profileComplete: false }), false);
  assert.equal(hasCompletedProfile({ profileComplete: true }), true);
  assert.equal(hasCompletedProfile({}), true); // Legacy completed profiles lack the flag.
});

test('Google name and photo are available as editable profile defaults', () => {
  assert.deepEqual(splitGoogleDisplayName('  Mary Jane Doe  '), {
    firstName: 'Mary', lastName: 'Jane Doe',
  });
  assert.deepEqual(splitGoogleDisplayName('Prince'), { firstName: 'Prince', lastName: '' });
  assert.equal(isGooglePhotoURL('https://lh3.googleusercontent.com/a/example'), true);
  assert.equal(isGooglePhotoURL('https://example.com/a/example'), false);
});

test('selected JPEG or Google picture maps to the saved private and public photo field', () => {
  assert.deepEqual(profilePhotoFields({ photoURL: 'https://lh3.googleusercontent.com/a/example' }), {
    photoURL: 'https://lh3.googleusercontent.com/a/example',
  });
  assert.deepEqual(profilePhotoFields({ dataUrl: 'data:image/jpeg;base64,abcd' }), {
    photoDataUrl: 'data:image/jpeg;base64,abcd',
  });
  assert.deepEqual(profilePhotoFields(), {});
});
