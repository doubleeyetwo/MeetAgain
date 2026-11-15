
import { useState } from 'react';
import {
  Alert,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ContinueButton } from '@/components/ContinueButton';
import {
  colors,
  fontFamily,
  radius,
  spacing,
  text,
  gradients,
  gradientDirection,
} from '@/theme';

import { auth } from '@/config/firebase';
import { saveEventDetails } from '@/features/events/eventEditingService';

import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';
import type { AppStackParamList } from '@/navigation/types';

type CreationProps = NativeStackScreenProps<
  EventCreationStackParamList,
  'PickLocation'
>;

type EditingProps = NativeStackScreenProps<
  AppStackParamList,
  'EditEventLocation'
>;

type ScreenProps =
  | { mode: 'create'; screen: CreationProps }
  | { mode: 'edit'; screen: EditingProps };

type LocationPick = {
  id: string;
  name: string;
  address: string;
  price: string;
  rating: string;
};

// Placeholder picks until a suggestions source exists.
const MEETAGAIN_PICKS: LocationPick[] = [
  {
    id: 'pedros-diner',
    name: "Pedro's Diner",
    address: '12345 Main St. Long Beach',
    price: '~$25 per',
    rating: '4.6',
  },
  {
    id: 'tonys-fish-grill',
    name: "Tony's Fish Grill",
    address: '32225 Blue St. Long Beach',
    price: '~$21 per',
    rating: '4.2',
  },
];

export function PickLocationScreen(props: CreationProps) {
  return <LocationForm mode="create" screen={props} />;
}

export function EditEventLocationScreen(props: EditingProps) {
  return <LocationForm mode="edit" screen={props} />;
}

function LocationForm(props: ScreenProps) {
  const params = props.screen.route.params;
  const isEditing = props.mode === 'edit';

  const [address, setAddress] = useState(
    params.location ?? ''
  );

  const [selectedPickId, setSelectedPickId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSelectPick = (pick: LocationPick) => {
    if (saving) return;

    setAddress(pick.address);
    setSelectedPickId(pick.id);
    setError('');
  };

  const handleChangeAddress = (value: string) => {
    setAddress(value);
    setSelectedPickId('');

    if (error) setError('');
  };

  const handleConfirmLocation = async () => {
    const trimmed = address.trim();

    if (!trimmed) {
      setError('Enter an address.');
      return;
    }

    if (props.mode === 'edit') {
      if (saving) return;

      const actorId = auth.currentUser?.uid;

      if (!actorId) {
        Alert.alert(
          'Sign In Required',
          'Please sign in before editing this event.'
        );
        return;
      }

      setSaving(true);

      try {
        await saveEventDetails(
          props.screen.route.params.editingEventId,
          actorId,
          { location: trimmed }
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

    navigation.navigate('PickTime', {
      ...route.params,
      location: trimmed,
    });
  };

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
          title={
            isEditing
              ? 'Edit Event Location'
              : 'Choose Location'
          }
          onBack={() => props.screen.navigation.goBack()}
        />

        <View style={styles.content}>
          <Text style={styles.picksHeading}>
            MeetAgain&apos;s Picks
          </Text>

          <ScrollView
            style={styles.picks}
            contentContainerStyle={styles.picksContent}
            keyboardShouldPersistTaps="handled"
          >
            {MEETAGAIN_PICKS.map((pick) => (
              <Pressable
                key={pick.id}
                disabled={saving}
                onPress={() => handleSelectPick(pick)}
                style={({ pressed }) => [
                  styles.pickCard,
                  selectedPickId === pick.id &&
                    styles.pickCardSelected,
                  pressed && styles.pickCardPressed,
                ]}
              >
                <View style={styles.pickDetails}>
                  <Text style={styles.pickName}>
                    {pick.name}
                  </Text>

                  <Text style={styles.pickAddress}>
                    {pick.address}
                  </Text>

                  <View style={styles.pickPriceRow}>
                    <Text style={styles.pickPrice}>
                      {pick.price}
                    </Text>

                    <Ionicons
                      name="person-outline"
                      size={13}
                      color={colors.white}
                    />
                  </View>
                </View>

                <View style={styles.pickRating}>
                  <Text style={styles.pickRatingText}>
                    {pick.rating}
                  </Text>

                  <Ionicons
                    name="star"
                    size={16}
                    color={colors.white}
                  />
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.white}
                />
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.bottomArea}>
            <View style={styles.searchField}>
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.white}
              />

              <TextInput
                value={address}
                onChangeText={handleChangeAddress}
                placeholder="Enter Address"
                placeholderTextColor={colors.white}
                style={styles.searchInput}
                autoCapitalize="words"
                returnKeyType="done"
                editable={!saving}
                onSubmitEditing={() =>
                  void handleConfirmLocation()
                }
              />
            </View>

            {error ? (
              <Text style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            <ContinueButton
              title={
                saving
                  ? 'Saving...'
                  : isEditing
                    ? 'Save Changes'
                    : 'Confirm Location'
              }
              onPress={() =>
                void handleConfirmLocation()
              }
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

  picksHeading: {
    ...text.title,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  picks: {
    flexGrow: 0,
  },

  picksContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },

  pickCard: {
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  pickCardSelected: {
    borderWidth: 2,
    borderColor: colors.primaryAccent,
  },

  pickCardPressed: {
    opacity: 0.85,
  },

  pickDetails: {
    flex: 1,
    gap: spacing.xs,
  },

  pickName: {
    ...text.header,
    color: colors.white,
  },

  pickAddress: {
    ...text.body,
    color: colors.white,
  },

  pickPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  pickPrice: {
    ...text.body,
    color: colors.white,
  },

  pickRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  pickRatingText: {
    ...text.header,
    color: colors.white,
  },

  bottomArea: {
    marginTop: 'auto',
    paddingBottom: 40,
    gap: spacing.md,
  },

  searchField: {
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  searchInput: {
    flex: 1,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
  },

  errorText: {
    ...text.body,
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.xs,
    color: colors.danger,
  },
});
