import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/Logo';
import { AuthStackParamList } from '@/navigation/types';
import { colors, fontFamily, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type ResetPasswordSentRoute = RouteProp<AuthStackParamList, 'ResetPasswordSent'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function ResetPasswordSentScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const { params } = useRoute<ResetPasswordSentRoute>();

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Logo />

          <View style={styles.headings}>
            <Ionicons name="mail-unread-outline" size={56} color={colors.primaryAccent} />
            <Text style={styles.title}>Check your email</Text>
            {/* Firebase hides whether an email is registered by default, so don't promise delivery. */}
            <Text style={styles.message}>
              If an account exists for <Text style={styles.email}>{params.email}</Text>, we've sent it a
              link to reset your password.
            </Text>
            <Text style={styles.message}>
              Open the link to choose a new password, then sign in with it. Don't see the email? Check
              your spam folder.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            // Return to the existing sign-in screen rather than stacking a new one.
            onPress={() => navigation.popTo('SignIn')}
            style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={gradients.purpleAccent}
              {...gradientDirection.horizontal}
              style={styles.buttonFill}
            >
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default ResetPasswordSentScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  headings: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...text.header, color: colors.white },
  message: { ...text.body, lineHeight: 20, color: colors.white, textAlign: 'center' },
  email: { fontFamily: fontFamily.semibold },
  buttonShell: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  buttonFill: {
    height: sizes.controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.85 },
});
