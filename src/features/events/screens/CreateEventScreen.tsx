import { eventAlert } from '@/features/events/eventAlert';

import { useState } from 'react';
import {
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ContinueButton } from '@/components/ContinueButton';
import {
  pickPhotoFromLibrary,
  takeProfilePhoto,
} from '@/features/auth/profilePhoto';
import {
  colors,
  fontFamily,
  radius,
  spacing,
  gradients,
  gradientDirection,
} from '@/theme';
import { EditPhoto } from '@/components/EditPhoto';
import { getTemplate } from '@/features/events/eventTemplates';
import { saveEventDetails } from '@/features/events/eventEditingService';
import { auth } from '@/config/firebase';

import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';
import type { AppStackParamList } from '@/navigation/types';

type CreationProps = NativeStackScreenProps<
  EventCreationStackParamList,
  'EventDetails'
>;

type EditingProps = NativeStackScreenProps<
  AppStackParamList,
  'EditEventDetails'
>;

type ScreenProps =
  | { mode: 'create'; screen: CreationProps }
  | { mode: 'edit'; screen: EditingProps };

const EVENT_CATEGORIES = [
  'Food & Dining',
  'Outdoors',
  'Entertainment',
  'Study',
  'Sports & Fitness',
  'Other',
];

export function CreateEventScreen(props: CreationProps) {
  return <EventDetailsForm mode="create" screen={props} />;
}

export function EditEventDetailsScreen(props: EditingProps) {
  return <EventDetailsForm mode="edit" screen={props} />;
}

function EventDetailsForm(props: ScreenProps) {
  const isEditing = props.mode === 'edit';
  const params = props.screen.route.params;

  const [eventName, setEventName] = useState(
    params?.eventName ?? ''
  );

  const [category, setCategory] = useState(() => {
    const initialCategory = params?.category ?? '';

    if (
      initialCategory &&
      !EVENT_CATEGORIES.includes(initialCategory)
    ) {
      return 'Other';
    }

    return initialCategory;
  });

  const [customCategory, setCustomCategory] = useState(
    params?.category &&
      !EVENT_CATEGORIES.includes(params.category)
      ? params.category
      : ''
  );

  const [showCategories, setShowCategories] = useState(false);

  const [eventPhoto, setEventPhoto] = useState<string | null>(
    params?.eventPhoto ?? null
  );

  const [photoLoading, setPhotoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        eventAlert('Photo Error', result.error);
        return;
      }

      if (result.photo) {
        setEventPhoto(result.photo.dataUrl);
      }
    } catch {
      eventAlert(
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

    eventAlert(
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

  const handleConfirmDetails = async () => {
    const trimmedName = eventName.trim();

    if (!trimmedName) {
      Alert.alert('Missing Details', 'Enter an event name.');
      return;
    }

    if (!resolvedCategory) {
      Alert.alert(
        'Missing Details',
        'Select or enter an event category.'
      );
      return;
    }

    if (props.mode === 'edit') {
      const actorId = auth.currentUser?.uid;

      if (!actorId) {
        Alert.alert(
          'Sign In Required',
          'Please sign in before editing this event.'
        );
        return;
      }

      if (saving) return;

      setSaving(true);

      try {
        await saveEventDetails(
          props.screen.route.params.editingEventId,
          actorId,
          {
            title: trimmedName,
            category: resolvedCategory,
          }
        );

        props.screen.navigation.goBack();
      } catch (error) {
        Alert.alert(
          'Unable to Save',
          error instanceof Error
            ? error.message
            : 'Please try again.'
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    const { navigation, route } = props.screen;

    const updatedDetails = {
      eventName: trimmedName,
      category: resolvedCategory,
      presetId: route.params?.presetId,
      eventPhoto,
    };

    if (route.params?.editingFromReview) {
      if (
        !route.params.startAt ||
        !route.params.endAt
      ) {
        Alert.alert(
          'Error',
          'Event date and time are missing.'
        );
        return;
      }

      navigation.navigate({
        name: 'ReviewEvent',
        params: {
          ...route.params,
          ...updatedDetails,
          startAt: route.params.startAt,
          endAt: route.params.endAt,
          selectedMemberIds:
            route.params.selectedMemberIds ?? [],
        },
        merge: true,
        pop: true,
      });

      return;
    }

    navigation.navigate('SelectMembers', updatedDetails);
  };

  const screenTitle =
    props.mode === 'edit'
      ? 'Edit Event Details'
      : getTemplate(
          props.screen.route.params?.presetId
        )?.name ?? 'Add Custom Event';

  return (
    <LinearGradient
      colors={gradients.background}
      {...gradientDirection.vertical}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
        <ScreenHeader
          title={screenTitle}
          onBack={() => props.screen.navigation.goBack()}
        />

        <View style={styles.content}>
          {!isEditing && (
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
          )}

          <View
            style={[
              styles.form,
              isEditing && styles.editingForm,
            ]}
          >
            <TextInput
              value={eventName}
              onChangeText={setEventName}
              placeholder="Event Name"
              placeholderTextColor={colors.white}
              style={styles.input}
              editable={!saving}
            />

            <View style={styles.categoryWrapper}>
              <Pressable
                style={styles.categoryField}
                disabled={saving}
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
                  editable={!saving}
                />
              )}
            </View>
          </View>

          <View style={styles.continueContainer}>
            <ContinueButton
              title={
                saving
                  ? 'Saving...'
                  : isEditing
                    ? 'Save Changes'
                    : 'Confirm Details'
              }
              onPress={() => void handleConfirmDetails()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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

  editingForm: {
    paddingTop: 55,
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
    paddingBottom: 40,
  },
});
