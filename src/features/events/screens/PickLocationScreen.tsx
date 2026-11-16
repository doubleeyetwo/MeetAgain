import { useEffect, useState } from 'react';
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

import {
  getDeviceLocation,
  type DeviceCoords,
} from '@/features/events/deviceLocation';
import {
  distanceInMiles,
  formatDistance,
} from '@/features/events/distance';
import {
  fetchNearbyPlaces,
  type SuggestedPlace,
} from '@/features/events/placesService';
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

type LoadState = 'loading' | 'ready' | 'error';

// Campus, used when the planner's own position is not available. Issue #52
// wants group members' locations here instead, which needs a member location
// field that does not exist yet.
const FALLBACK_COORDS = {
  latitude: 33.7838,
  longitude: -118.1141,
};

// "Park", or "Mexican Restaurant  ·  $$" when Google reports a price. This is
// the line that tells a planner whether Colorado Lagoon is a lake or a diner.
function describePick(pick: SuggestedPlace): string {
  return [pick.typeLabel, pick.priceLabel]
    .filter(Boolean)
    .join('  ·  ');
}

// "~3 mi" from the planner to the place, or nothing when either position is
// unknown. Straight line, which is why the card hedges with a "~".
function describeDistance(
  from: DeviceCoords | null,
  pick: SuggestedPlace
): string {
  if (!from || !pick.coords) return '';

  return formatDistance(distanceInMiles(from, pick.coords));
}

// Keep manual address entry available while testing without Places requests.
const placeSuggestionsEnabled =
  process.env.EXPO_PUBLIC_ENABLE_PLACE_SUGGESTIONS !== 'false';

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
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [usingFallbackArea, setUsingFallbackArea] = useState(false);

  // Only set when the planner's own position is known. Measuring from the
  // campus fallback would put a distance on the card that is not the
  // planner's, which is worse than showing none.
  const [userCoords, setUserCoords] = useState<DeviceCoords | null>(null);

  const { category } = params;
  const presetId = props.mode === 'create' ? props.screen.route.params.presetId : undefined;

  useEffect(() => {
    if (!placeSuggestionsEnabled) return;

    // A planner who leaves before the search resolves must not get a state
    // update on an unmounted screen.
    let cancelled = false;

    async function loadSuggestions() {
      const location = await getDeviceLocation();
      const coords =
        location.status === 'granted'
          ? location.coords
          : FALLBACK_COORDS;

      if (cancelled) return;

      setUsingFallbackArea(location.status !== 'granted');
      setUserCoords(
        location.status === 'granted' ? location.coords : null
      );

      try {
        const places = await fetchNearbyPlaces(
          coords,
          category,
          presetId
        );

        if (cancelled) return;

        setSuggestions(places);
        setLoadState('ready');
      } catch {
        if (cancelled) return;

        setLoadState('error');
      }
    }

    loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [category, presetId]);

  const handleSelectPick = (pick: SuggestedPlace) => {
    if (saving) return;
    setAddress(pick.address || pick.name);
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

    const { editingFromReview, ...details } = route.params;
    const params = { ...details, location: trimmed };
    if (editingFromReview) {
      navigation.navigate({ name: 'ReviewEvent', params, merge: true, pop: true });
      return;
    }
    navigation.navigate('ReviewEvent', params);
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
        {placeSuggestionsEnabled ? (
          <>
            <Text style={styles.picksHeading}>
              MeetAgain&apos;s Picks
            </Text>

            <ScrollView
              style={styles.picks}
              contentContainerStyle={styles.picksContent}
              keyboardShouldPersistTaps="handled"
            >
              {loadState === 'loading' ? (
                <Text style={styles.picksStatus}>
                  Finding places nearby...
                </Text>
              ) : null}

              {loadState === 'error' ? (
                <Text style={styles.picksStatus}>
                  Could not load suggestions. Enter an address
                  below.
                </Text>
              ) : null}

              {loadState === 'ready' && !suggestions.length ? (
                <Text style={styles.picksStatus}>
                  No places found nearby. Enter an address below.
                </Text>
              ) : null}

              {loadState === 'ready' && usingFallbackArea ? (
                <Text style={styles.picksStatus}>
                  Showing places near campus because location
                  access is off.
                </Text>
              ) : null}

              {suggestions.map((pick) => (
                <Pressable
                  key={pick.id}
                  onPress={() => handleSelectPick(pick)}
                  style={({ pressed }) => [
                    styles.pickCard,
                    selectedPickId === pick.id &&
                      styles.pickCardSelected,
                    pressed && styles.pickCardPressed,
                  ]}
                >
                  <View style={styles.pickIcon}>
                    <Ionicons
                      name={pick.icon as never}
                      size={20}
                      color={colors.white}
                    />
                  </View>

                  <View style={styles.pickDetails}>
                    <Text
                      style={styles.pickName}
                      numberOfLines={2}
                    >
                      {pick.name}
                    </Text>

                    {describePick(pick) ? (
                      <Text
                        style={styles.pickType}
                        numberOfLines={1}
                      >
                        {describePick(pick)}
                      </Text>
                    ) : null}

                    <Text
                      style={styles.pickAddress}
                      numberOfLines={1}
                    >
                      {pick.address}
                    </Text>
                  </View>

                  <View style={styles.pickMetrics}>
                    {pick.rating === null ? null : (
                      <View style={styles.pickRating}>
                        <Text style={styles.pickRatingText}>
                          {pick.rating.toFixed(1)}
                        </Text>

                        <Ionicons
                          name="star"
                          size={16}
                          color={colors.white}
                        />
                      </View>
                    )}

                    {describeDistance(userCoords, pick) ? (
                      <Text style={styles.pickDistance}>
                        {describeDistance(userCoords, pick)}
                      </Text>
                    ) : null}
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.white}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
          <View style={styles.bottomArea}>
            <View style={styles.searchField}>
              <Ionicons name="location-outline" size={16} color={colors.white} />

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

  picksStatus: {
    ...text.body,
    color: colors.white,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  pickCard: {
    minHeight: 100,
    borderRadius: radius.md,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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

  pickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pickDetails: {
    flex: 1,
    gap: 2,
  },

  pickName: {
    ...text.header,
    color: colors.white,
  },

  pickAddress: {
    ...text.body,
    color: colors.white,
  },

  pickType: {
    ...text.body,
    fontSize: 12,
    color: colors.fieldLabel,
  },

  pickMetrics: {
    alignItems: 'flex-end',
    gap: 2,
  },

  pickRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  pickDistance: {
    ...text.body,
    fontSize: 12,
    color: colors.fieldLabel,
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
