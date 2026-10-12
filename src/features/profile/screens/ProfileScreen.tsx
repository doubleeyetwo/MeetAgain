import { useRef, useState } from 'react';
import { Button, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import { Screen } from '@/components/Screen';
import { auth } from '@/config/firebase';
import { AppStackParamList } from '@/navigation/types';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
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

  return (
    <Screen title="Profile">
      <Text>Profile, memories, and calendar privacy settings.</Text>
      {/* Keep one entry point for search, requests, and the accepted friends list. */}
      <Button title="Find and manage friends" onPress={() => navigation.navigate('Friends')} />
      <Button title={signingOut ? 'Signing out...' : 'Sign Out'} onPress={onSignOut} disabled={signingOut} />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </Screen>
  );
}
