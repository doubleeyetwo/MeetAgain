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

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
    >
      {profilePending ? (
        // Removing signed-out routes forces the router to show setup even when
        // Google returns to an already-mounted Register or SignIn stack.
        <Stack.Screen name="CreateProfile" component={CreateProfileScreen} navigationKey="pending-profile" />
      ) : (
        <>
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Password" component={PasswordScreen} />
          <Stack.Screen name="CreateProfile" component={CreateProfileScreen} navigationKey="email-signup" />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
