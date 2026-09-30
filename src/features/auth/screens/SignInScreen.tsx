import { Button, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { AuthStackParamList } from '@/navigation/types';
type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
export function SignInScreen({ navigation }: Props) { return <Screen title="Welcome back"><Text>Sign in with email or Google.</Text><Button title="Create account" onPress={() => navigation.navigate('Register')} /><Button title="Forgot password" onPress={() => navigation.navigate('ForgotPassword')} /></Screen>; }
