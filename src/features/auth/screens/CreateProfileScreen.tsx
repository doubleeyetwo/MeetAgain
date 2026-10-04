import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth, ProfilePhoto } from '@/features/auth/AuthContext';
import {
  PROFILE_PHOTO_COMPRESSION,
  PROFILE_PHOTO_JPEG_PREFIX,
  PROFILE_PHOTO_MAX_DATA_URL_LENGTH,
  PROFILE_PHOTO_RESIZE_WIDTH,
} from '@/features/auth/profilePhoto';
import { validateProfile } from '@/features/auth/profileValidation';
import { AuthStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function CreateProfileScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const { createAccount, profilePending } = useAuth();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [photo, setPhoto] = useState<ProfilePhoto | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy && !profilePending });
  }, [navigation, busy, profilePending]);

  const usePickedPhoto = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setPhotoBusy(true);
    try {
      const resized = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: PROFILE_PHOTO_RESIZE_WIDTH } }], {
        compress: PROFILE_PHOTO_COMPRESSION,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!resized.base64) {
        throw new Error('Photo conversion failed.');
      }
      const dataUrl = `${PROFILE_PHOTO_JPEG_PREFIX}${resized.base64}`;
      if (dataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH) {
        setError('This photo is too detailed. Choose a simpler photo under 150 KB.');
        return;
      }
      setPhoto({ uri: resized.uri, dataUrl });
      setError('');
    } catch {
      setError('Could not prepare your photo. Please choose another.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const chooseFromLibrary = async () => {
    try {
      await usePickedPhoto(await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      }));
    } catch {
      setError('Could not open your photos. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Allow camera access to take a profile photo.');
        return;
      }
      await usePickedPhoto(await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      }));
    } catch {
      setError('Could not open the camera. Please try again.');
    }
  };

  const onPhotoPress = () => {
    if (Platform.OS === 'web') {
      void chooseFromLibrary();
    } else {
      Alert.alert('Profile photo', 'Choose a photo or take a new one.', [
        { text: 'Choose photo', onPress: () => { void chooseFromLibrary(); } },
        { text: 'Take photo', onPress: () => { void takePhoto(); } },
        ...(photo ? [{ text: 'Remove photo', onPress: () => setPhoto(undefined) }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const onJoin = async () => {
    if (busyRef.current || photoBusy) return;
    const result = validateProfile({ firstName, lastName, username, dateOfBirth });
    if (!result.profile) {
      setError(result.error ?? 'Check your profile details.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await createAccount(result.profile, photo);
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;
      switch (code) {
        case 'auth/email-already-in-use':
          setError('An account already uses this email. Go back and choose another email.');
          break;
        case 'auth/invalid-email':
          setError('This email address is invalid. Go back and correct it.');
          break;
        case 'auth/weak-password':
          setError('Choose a stronger password. Go back and change it.');
          break;
        case 'auth/network-request-failed':
          setError('Check your connection and try again.');
          break;
        case 'auth/operation-not-allowed':
          setError('Email and password signup is not enabled in Firebase yet.');
          break;
        default:
          setError(failure instanceof Error ? failure.message : 'Could not finish signup. Please try again.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to password"
                onPress={() => navigation.goBack()}
                disabled={busy || profilePending}
                hitSlop={12}
                style={styles.backButton}
              >
                <Text style={styles.backChevron}>‹</Text>
              </Pressable>
              <Text style={styles.title}>Create Profile</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photo ? 'Change profile photo' : 'Add profile photo'}
              onPress={onPhotoPress}
              disabled={busy || photoBusy}
              style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
            >
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              ) : (
                <Svg width={38} height={38} viewBox="0 0 40 40" fill="none" accessibilityElementsHidden>
                  <Path
                    d="M6 13h6l3-4h10l3 4h6v18H6V13Z"
                    stroke={colors.white}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  <Circle cx={20} cy={22} r={6} stroke={colors.white} strokeWidth={2} />
                  <Path
                    d="M31 7v8M27 11h8"
                    stroke={colors.white}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              )}
            </Pressable>
            <Text style={styles.photoHint}>{photoBusy ? 'Preparing photo...' : 'Add a photo (optional)'}</Text>

            <View style={styles.fields}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  setError('');
                }}
                placeholder="First Name..."
                placeholderTextColor={colors.white}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                maxLength={80}
                accessibilityLabel="First name"
                editable={!busy}
                style={styles.input}
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                value={lastName}
                onChangeText={(value) => {
                  setLastName(value);
                  setError('');
                }}
                placeholder="Last Name..."
                placeholderTextColor={colors.white}
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
                maxLength={80}
                accessibilityLabel="Last name"
                editable={!busy}
                style={styles.input}
              />

              <Text style={styles.label}>
                Username <Text style={styles.helper}>(Must be unique)</Text>
              </Text>
              <TextInput
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setError('');
                }}
                placeholder="Username..."
                placeholderTextColor={colors.white}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                accessibilityLabel="Username"
                accessibilityHint="3 to 20 letters, numbers, or underscores"
                editable={!busy}
                style={styles.input}
              />
              <Text style={styles.usernameHint}>3–20 letters, numbers, or underscores</Text>

              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                value={dateOfBirth}
                onChangeText={(value) => {
                  setDateOfBirth(value);
                  setError('');
                }}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.white}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                accessibilityLabel="Date of birth, month day year"
                editable={!busy}
                style={styles.input}
              />
            </View>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <View style={styles.buttonSpacer} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Join MeetAgain"
              onPress={onJoin}
              disabled={busy || photoBusy}
              style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={gradients.purpleAccent}
                {...gradientDirection.horizontal}
                style={styles.buttonFill}
              >
                <Text style={styles.buttonText}>{busy ? 'Creating profile...' : profilePending ? 'Retry Join MeetAgain' : 'Join MeetAgain'}</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default CreateProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 44,
    justifyContent: 'center',
    zIndex: 1,
  },
  backChevron: {
    color: colors.white,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '300',
  },
  title: { ...text.title, color: colors.white },
  photoButton: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.cardDarker,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: {
    ...text.body,
    color: colors.white,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  fields: { marginTop: spacing.xl },
  label: {
    ...text.body,
    color: colors.white,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  helper: { color: '#b9a9cd' },
  input: {
    ...text.body,
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    color: colors.white,
    textAlign: 'center',
  },
  usernameHint: {
    ...text.body,
    fontSize: 12,
    color: '#b9a9cd',
    marginTop: spacing.xs,
  },
  error: {
    ...text.body,
    color: '#ff9aa8',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  buttonSpacer: { flexGrow: 1, minHeight: spacing.xxl },
  buttonShell: { borderRadius: radius.sm, overflow: 'hidden' },
  buttonFill: {
    height: sizes.controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.85 },
});
