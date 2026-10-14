import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { PasswordScreen } from '@/features/auth/screens/PasswordScreen';
import { CreateProfileScreen } from '@/features/auth/screens/CreateProfileScreen';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { AuthStackParamList } from './types';
import { useAuth } from '@/features/auth/AuthContext';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { profilePending } = useAuth();

  // Resume incomplete account setup at its profile step after auth state is restored.
  // initialRouteName is read once per mount, so the key remounts the stack when the
  // flag flips. Google sign-in reaches this state without navigating anywhere, and
  // without the remount it leaves the user sitting on Register.
  return (
    <Stack.Navigator
      key={profilePending ? 'profile-pending' : 'signed-out'}
      initialRouteName={profilePending ? 'CreateProfile' : 'Register'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Password" component={PasswordScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
