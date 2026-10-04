import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { PasswordScreen } from '@/features/auth/screens/PasswordScreen';
import { CreateProfileScreen } from '@/features/auth/screens/CreateProfileScreen';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { AuthStackParamList } from './types';
import { useAuth } from '@/features/auth/AuthContext';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { profilePending } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={profilePending ? 'CreateProfile' : 'Register'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Password" component={PasswordScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
