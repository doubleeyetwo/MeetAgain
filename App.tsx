import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppNavigator } from '@/navigation/AppNavigator';
import { AuthNavigator } from '@/navigation/AuthNavigator';

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  return user ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  return <AuthProvider><NavigationContainer><RootNavigator /></NavigationContainer><StatusBar style="auto" /></AuthProvider>;
}
