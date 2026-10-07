import { useRef, useState } from 'react';
import { Button, Text, TextInput } from 'react-native';
import { signOut } from 'firebase/auth';
import { collection, getDocs, limit, query, where, doc, getDoc } from 'firebase/firestore';
import { Screen } from '@/components/Screen';
import { auth, db } from '@/config/firebase';

type UserResult = { id: string; username: string };

export function ProfileScreen() {
  const [signingOut, setSigningOut] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const busyRef = useRef(false);

  const onSignOut = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSigningOut(true);
    setError('');
    try {
      await signOut(auth);
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      busyRef.current = false;
      setSigningOut(false);
    }
  };

  const onUserSearch = async () => {
  const username = searchText.trim().toLowerCase();
  if (!username || busyRef.current) return;
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    setError('Usernames are 3-20 characters: letters, numbers, underscores.');
    return;
  }
  busyRef.current = true;
  setSearching(true);
  setError('');
  try {
    const snap = await getDoc(doc(db, 'usernames', username));
    setResults(
      snap.exists() ? [{ id: snap.data().uid as string, username }] : [],
    );
  } catch (e: any) {
    console.log('search error', e?.code, e?.message);
    setError('Could not search for users. Please try again.');
  } finally {
    busyRef.current = false;
    setSearching(false);
  }
};

  const busy = signingOut || searching;

  return (
    <Screen title="Profile">
      <Text>Profile, memories, and calendar privacy settings.</Text>
      <Button
        title={signingOut ? 'Signing out...' : 'Sign Out'}
        onPress={onSignOut}
        disabled={busy}
      />
      <TextInput
        value={searchText}
        placeholder="Search for a user"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onChangeText={setSearchText}
        onSubmitEditing={onUserSearch}
      />
      <Button
        title={searching ? 'Searching...' : 'Search User'}
        onPress={onUserSearch}
        disabled={busy || !searchText.trim()}
      />
      {results.map(user => (
        <Text key={user.id}>{user.username}</Text>
      ))}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </Screen>
  );
}