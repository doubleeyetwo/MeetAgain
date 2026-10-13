import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { PasswordScreen } from '@/features/auth/screens/PasswordScreen';
import { CreateProfileScreen } from '@/features/auth/screens/CreateProfileScreen';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
<<<<<<< Updated upstream
import { ResetPasswordSentScreen } from '@/features/auth/screens/ResetPasswordSentScreen';
=======
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
>>>>>>> Stashed changes
import { AuthStackParamList } from './types';
import { useAuth } from '@/features/auth/AuthContext';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { profilePending } = useAuth();

  // Resume incomplete account setup at its profile step after auth state is restored.
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
<<<<<<< Updated upstream
      <Stack.Screen name="ResetPasswordSent" component={ResetPasswordSentScreen} />
=======
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
>>>>>>> Stashed changes
    </Stack.Navigator>
  );
}
