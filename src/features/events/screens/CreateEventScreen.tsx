import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ContinueButton } from '@/components/ContinueButton';
import { colors, fontFamily, radius, spacing } from '@/theme';

const EVENT_CATEGORIES = [
  'Food & Dining',
  'Outdoors',
  'Entertainment',
  'Study',
  'Sports & Fitness',
  'Other',
];

export function CreateEventScreen() {
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Add Custom Event" />

      <View style={styles.content}>
        <Pressable style={styles.photoArea}>
          <View style={styles.photoCircle}>
            <Ionicons
              name="camera-outline"
              size={54}
              color={colors.white}
            />
          </View>

          <Text style={styles.photoText}>Add Photo</Text>
        </Pressable>

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
              onPress={() => setShowCategories((current) => !current)}
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
                name={showCategories ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.white}
              />
            </Pressable>

            {showCategories && (
              <View style={styles.dropdown}>
                {EVENT_CATEGORIES.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCategory(item);
                      setShowCategories(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.continueContainer}>
          <ContinueButton
            title="Confirm Details"
            onPress={() => {
              // Navigation will be connected next.
            }}
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
    borderRadius: radius.md,
    backgroundColor: colors.cardLighter,
    overflow: 'hidden',
    zIndex: 20,
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

  continueContainer: {
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
});