import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth, ProfilePhoto } from '@/features/auth/AuthContext';
import { pickPhotoFromLibrary, takeProfilePhoto } from '@/features/auth/profilePhoto';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';
import { UserProfile } from '@/types/models';

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;

const BIO_MAX_LENGTH = 300;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function EditProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { user } = useAuth();
  const busyRef = useRef(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<ProfilePhoto | undefined>();
  const [existingPhoto, setExistingPhoto] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      try {
        const snapshot = await getDoc(doc(db, collections.users, user.uid));
        if (!active) return;
        const profile = snapshot.data() as UserProfile | undefined;
        setFirstName(profile?.firstName ?? '');
        setLastName(profile?.lastName ?? '');
        setDateOfBirth(profile?.dateOfBirth ?? '');
        setBio(profile?.bio ?? '');
        setExistingPhoto(profile?.photoDataUrl ?? profile?.photoURL);
      } catch {
        if (active) setError('Could not load your profile. Go back and try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const applyPick = async (pick: () => Promise<{ photo?: ProfilePhoto; error?: string }>) => {
    const result = await pick();
    if (result.error) setError(result.error);
    else if (result.photo) {
      setPhoto(result.photo);
      setError('');
    }
  };

  const onPhotoPress = () => {
    if (Platform.OS === 'web') {
      void applyPick(pickPhotoFromLibrary);
      return;
    }
    Alert.alert('Profile photo', 'Choose a photo or take a new one.', [
      { text: 'Choose photo', onPress: () => { void applyPick(pickPhotoFromLibrary); } },
      { text: 'Take photo', onPress: () => { void applyPick(takeProfilePhoto); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onSave = async () => {
    // The ref closes the same-tick double-tap window before React updates the disabled state.
    if (busyRef.current || !user) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      setError('Enter your first and last name.');
      return;
    }
    if (trimmedFirst.length > 80 || trimmedLast.length > 80) {
      setError('Keep each name under 80 characters.');
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, collections.users, user.uid), {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        displayName: `${trimmedFirst} ${trimmedLast}`,
        bio: bio.trim(),
        ...(photo ? { photoDataUrl: photo.dataUrl } : {}),
        updatedAt: serverTimestamp(),
      });
      navigation.goBack();
    } catch {
      setError('Could not save your profile. Please try again.');
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const avatarUri = photo?.uri ?? existingPhoto;

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            disabled={saving}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>

          <Text style={styles.title}>Edit Profile</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
            hitSlop={12}
            onPress={onSave}
            disabled={saving || loading}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.save}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} style={styles.loader} />
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={avatarUri ? 'Change profile photo' : 'Add profile photo'}
                  onPress={onPhotoPress}
                  disabled={saving}
                  style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Ionicons name="person" size={44} color={colors.white} />
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={22} color={colors.white} />
                  </View>
                </Pressable>

                <Field label="First Name">
                  <TextInput
                    value={firstName}
                    onChangeText={(value) => {
                      setFirstName(value);
                      if (error) setError('');
                    }}
                    placeholder="First name"
                    placeholderTextColor={colors.white}
                    autoCapitalize="words"
                    editable={!saving}
                    accessibilityLabel="First name"
                    style={styles.input}
                  />
                </Field>

                <Field label="Last Name">
                  <TextInput
                    value={lastName}
                    onChangeText={(value) => {
                      setLastName(value);
                      if (error) setError('');
                    }}
                    placeholder="Last name"
                    placeholderTextColor={colors.white}
                    autoCapitalize="words"
                    editable={!saving}
                    accessibilityLabel="Last name"
                    style={styles.input}
                  />
                </Field>

                <Field label="Date of Birth">
                  {/* Read-only here: changing it needs the same validation the signup flow runs. */}
                  <View style={[styles.input, styles.readOnly]}>
                    <Text style={styles.readOnlyText}>{dateOfBirth || 'Not set'}</Text>
                  </View>
                </Field>

                <Field label="Bio">
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell people what you are into."
                    placeholderTextColor={colors.white}
                    multiline
                    maxLength={BIO_MAX_LENGTH}
                    editable={!saving}
                    accessibilityLabel="Bio"
                    style={[styles.input, styles.bioInput]}
                  />
                </Field>

                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                ) : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default EditProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { ...text.title, color: colors.white },
  // The frame fills this with the purple gradient; RN needs a mask for that, so use the accent.
  save: { ...text.body, fontSize: 20, color: colors.primaryAccent },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  loader: { marginTop: spacing.xxl },
  avatarWrap: { alignSelf: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  avatar: { width: 99, height: 99, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: colors.cardDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -6,
    bottom: 0,
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginTop: spacing.md },
  label: { ...text.body, fontSize: 12, lineHeight: 16, color: colors.fieldLabel, padding: spacing.sm },
  input: {
    ...text.body,
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    color: colors.white,
  },
  readOnly: { justifyContent: 'center', opacity: 0.7 },
  readOnlyText: { ...text.body, color: colors.white },
  bioInput: {
    height: 123,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center', marginTop: spacing.md },
  pressed: { opacity: 0.85 },
});
