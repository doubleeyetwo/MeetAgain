// Shared collection names for Firestore data calls as feature storage is added.
export const collections = {
  users: 'users',
  usernames: 'usernames',
  events: 'events',
  polls: 'availabilityPolls',
  notifications: 'notifications',
  friendships: 'friendships',
  freeNow: 'freeNow',
  memories: 'memories',
  publicProfiles: 'publicProfiles',
} as const;
