import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
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
