import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { auth } from '@/config/firebase';
import { getGoogleCalendarSnapshot, importGoogleCalendar } from '@/features/calendar/googleCalendar';
import { getGoogleCalendarToken } from '@/features/calendar/googleCalendarTokenCache';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppNavigator } from '@/navigation/AppNavigator';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import {
  useFonts,
  Moderustic_400Regular,
  Moderustic_600SemiBold,
} from '@expo-google-fonts/moderustic';

function RootNavigator() {
  const { user, loading } = useAuth();
  const calendarImportsInFlight = useRef(new Set<string>());

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    let previousAppState = AppState.currentState;

    const refreshCalendar = async () => {
      if (!active || calendarImportsInFlight.current.has(user.uid)) return;
      calendarImportsInFlight.current.add(user.uid);
      try {
        const token = getGoogleCalendarToken(user.uid);
        if (!token || auth.currentUser?.uid !== user.uid) return;
        const snapshot = await getGoogleCalendarSnapshot(user.uid);
        if (!snapshot || !active || auth.currentUser?.uid !== user.uid
          || getGoogleCalendarToken(user.uid) !== token) return;
        await importGoogleCalendar(user.uid, token);
      } catch {
        // Keep the saved snapshot available when a background refresh fails.
      } finally {
        calendarImportsInFlight.current.delete(user.uid);
      }
    };

    void refreshCalendar();
    const subscription = AppState.addEventListener('change', (state) => {
      const resumed = previousAppState !== 'active' && state === 'active';
      previousAppState = state;
      if (resumed) void refreshCalendar();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [loading, user?.uid]);

  // Wait for Firebase and the profile check before choosing which navigator to show.
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}

// Load the app font before mounting navigation and provide auth state to every screen.
export default function App() {
  const [fontsLoaded] = useFonts({ Moderustic_400Regular, Moderustic_600SemiBold });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
