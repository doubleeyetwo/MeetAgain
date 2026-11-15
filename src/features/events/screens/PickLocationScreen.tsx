import { useEffect, useState } from 'react';
import {
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

import { ScreenHeader } from '@/components/ScreenHeader';
import { ContinueButton } from '@/components/ContinueButton';
import { colors, fontFamily, radius, spacing, text } from '@/theme';

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

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'PickLocation'
>;

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

export function PickLocationScreen({
  navigation,
  route,
}: Props) {
  const [address, setAddress] = useState(
    route.params.location ?? ''
  );
  const [selectedPickId, setSelectedPickId] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [usingFallbackArea, setUsingFallbackArea] = useState(false);

  // Only set when the planner's own position is known. Measuring from the
  // campus fallback would put a distance on the card that is not the
  // planner's, which is worse than showing none.
  const [userCoords, setUserCoords] = useState<DeviceCoords | null>(null);

  const { category, presetId } = route.params;

  useEffect(() => {
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
    setAddress(pick.address || pick.name);
    setSelectedPickId(pick.id);
    setError('');
  };

  const handleChangeAddress = (value: string) => {
    setAddress(value);
    setSelectedPickId('');
    if (error) setError('');
  };

  const handleConfirmLocation = () => {
    const trimmed = address.trim();

    if (!trimmed) {
      setError('Enter an address.');
      return;
    }

    const { editingFromReview, ...details } = route.params;
    const params = { ...details, location: trimmed };
    if (editingFromReview) {
      navigation.navigate({ name: 'ReviewEvent', params, merge: true, pop: true });
      return;
    }
    navigation.navigate('ReviewEvent', params);
  };


  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Choose Location"
        onBack={() => navigation.goBack()}
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
              onSubmitEditing={handleConfirmLocation}
            />
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <ContinueButton
            title="Confirm Location"
            onPress={handleConfirmLocation}
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
    paddingBottom: spacing.lg,
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
