// import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import { AuthStackParamList } from './types';
// import { SignInScreen } from '@/features/auth/screens/SignInScreen';
// import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
// import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';

// const Stack = createNativeStackNavigator<AuthStackParamList>();
// export function AuthNavigator() { return <Stack.Navigator><Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'MeetAgain' }} /><Stack.Screen name="Register" component={RegisterScreen} /><Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} /></Stack.Navigator>; }

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';

const Stack = createNativeStackNavigator();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Register" component={RegisterScreen} />
      {/* your other screens */}
    </Stack.Navigator>
  );
}