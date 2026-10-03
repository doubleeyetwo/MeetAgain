import { useRef, useState } from 'react';
import { Button, Text } from 'react-native';
import { signOut } from 'firebase/auth';
import { Screen } from '@/components/Screen';
import { auth } from '@/config/firebase';

export function ProfileScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  const onSignOut = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await signOut(auth);
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen title="Profile">
      <Text>Profile, memories, and calendar privacy settings.</Text>
      <Button title={busy ? 'Signing out...' : 'Sign Out'} onPress={onSignOut} disabled={busy} />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </Screen>
  );
}
