
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ContinueButton } from '@/components/ContinueButton';
import {
  pickPhotoFromLibrary,
  takeProfilePhoto,
} from '@/features/auth/profilePhoto';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { EditPhoto } from '@/components/EditPhoto';


import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'EventDetails'
>;

const EVENT_CATEGORIES = [
  'Food & Dining',
  'Outdoors',
  'Entertainment',
  'Study',
  'Sports & Fitness',
  'Other',
];

export function CreateEventScreen({ navigation, route }: Props) {
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState(
    route.params?.category ?? ''
  );
  const [customCategory, setCustomCategory] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  const [eventPhoto, setEventPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const resolvedCategory =
    category === 'Other'
      ? customCategory.trim()
      : category;

  const chooseEventPhoto = async (
    source: 'camera' | 'library'
  ) => {
    if (photoLoading) return;

    setPhotoLoading(true);

    try {
      const result =
        source === 'camera'
          ? await takeProfilePhoto()
          : await pickPhotoFromLibrary();

      if (result.error) {
        Alert.alert('Photo Error', result.error);
        return;
      }

      if (result.photo) {
        setEventPhoto(result.photo.dataUrl);
      }
    } catch {
      Alert.alert(
        'Photo Error',
        'Unable to select your event photo. Please try again.'
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  const openPhotoOptions = () => {
    if (photoLoading) return;

    if (Platform.OS === 'web') {
      void chooseEventPhoto('library');
      return;
    }

    Alert.alert(
      'Event Photo',
      'Choose an event cover photo',
      [
        {
          text: 'Choose from Library',
          onPress: () => void chooseEventPhoto('library'),
        },
        {
          text: 'Take Photo',
          onPress: () => void chooseEventPhoto('camera'),
        },
        ...(eventPhoto
          ? [
              {
                text: 'Remove Photo',
                onPress: () => setEventPhoto(null),
              },
            ]
          : []),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  const handleConfirmDetails = () => {
    navigation.navigate('PickLocation', {
      eventName: eventName.trim(),
      category: resolvedCategory,
      presetId: route.params?.presetId,
      eventPhoto,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Add Custom Event"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.content}>
  <View style={styles.photoArea}>
    <EditPhoto
      photoUri={eventPhoto}
      onPress={openPhotoOptions}
      size={120}
      disabled={photoLoading}
    />

    <Text style={styles.photoText}>
      {photoLoading
        ? 'Loading Photo...'
        : eventPhoto
          ? 'Change Photo'
          : 'Add Photo'}
    </Text>
</View>

        <View style={styles.form}>
          <TextInput
            value={eventName}
            onChangeText={setEventName}
            placeholder="Event Name"
            placeholderTextColor={colors.white}
            style={styles.input}
          />

          <View style={styles.categoryWrapper}>
            <Pressable
              style={styles.categoryField}
              onPress={() =>
                setShowCategories((current) => !current)
              }
            >
              <Text
                style={[
                  styles.categoryText,
                  !category && styles.placeholderText,
                ]}
              >
                {category || 'Event Category'}
              </Text>

              <Ionicons
                name={
                  showCategories
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={20}
                color={colors.white}
              />
            </Pressable>

            {showCategories && (
              <ScrollView
                style={styles.dropdown}
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                {EVENT_CATEGORIES.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCategory(item);
                      setShowCategories(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {category === 'Other' && (
              <TextInput
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Enter Custom Category"
                placeholderTextColor={colors.white}
                style={styles.customCategoryInput}
                autoCapitalize="words"
              />
            )}
          </View>
        </View>

        <View style={styles.continueContainer}>
          <ContinueButton
            title="Confirm Details"
            onPress={handleConfirmDetails}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  content: {
    flex: 1,
    paddingHorizontal: 13,
  },

  photoArea: {
    height: 251,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.cardDarker,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  eventPhoto: {
    width: '100%',
    height: '100%',
  },

  photoText: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.white,
  },

  form: {
    alignItems: 'center',
    gap: 27,
  },

  input: {
    width: 278,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: 'center',
  },

  categoryWrapper: {
    width: 278,
    zIndex: 10,
  },

  categoryField: {
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  categoryText: {
    flex: 1,
    paddingLeft: 20,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.white,
  },

  placeholderText: {
    opacity: 0.9,
  },

  dropdown: {
    position: 'absolute',
    top: 54,
    width: '100%',
    maxHeight: 180,
    borderRadius: radius.md,
    backgroundColor: colors.cardLighter,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 20,
  },

  dropdownItem: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },

  dropdownText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
  },

  customCategoryInput: {
    width: '100%',
    height: 50,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: 'center',
  },

  continueContainer: {
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
});
