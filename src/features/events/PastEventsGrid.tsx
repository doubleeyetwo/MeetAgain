import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PhotoTile, PhotoTileGrid, TileGridMessage } from '@/components/PhotoTileGrid';
import { fetchLatestMemoryPhoto, fetchPastEvents } from '@/features/events/pastEventService';
import { colors, spacing, text } from '@/theme';

type PastEventsGridProps = {
  // Whose profile is showing.
  profileUid: string | undefined;
  // The signed-in user; they only ever see events they were invited to.
  viewerUid: string | undefined;
  emptyMessage: string;
  onOpenEvent: (eventId: string) => void;
};

type Loaded = { key: string; tiles: PhotoTile[] };

// The tiled past-events section under a profile's details.
export function PastEventsGrid({ profileUid, viewerUid, emptyMessage, onOpenEvent }: PastEventsGridProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = profileUid && viewerUid ? `${viewerUid}:${profileUid}` : null;

  // Reload on focus so a newly ended event or a just-added memory shows when returning here.
  useFocusEffect(
    useCallback(() => {
      if (!profileUid || !viewerUid) return;
      const loadKey = `${viewerUid}:${profileUid}`;
      let active = true;
      setError('');

      (async () => {
        try {
          const events = await fetchPastEvents(profileUid, viewerUid);
          // A tile shows the event's newest memory, then its cover photo, then its title.
          const memoryPhotos = await Promise.all(
            events.map((event) => fetchLatestMemoryPhoto(event.id).catch(() => null)),
          );
          if (!active) return;
          setLoaded({
            key: loadKey,
            tiles: events.map((event, index) => ({
              id: event.id,
              label: event.title || 'Untitled Event',
              photoUri: memoryPhotos[index] ?? event.photoURL ?? null,
            })),
          });
        } catch (cause) {
          console.error('Failed to load past events:', cause);
          if (active) setError('Could not load past events.');
        }
      })();

      return () => { active = false; };
    }, [profileUid, viewerUid, attempt]),
  );

  if (!key) return null;
  // Never show another profile's tiles while this one loads.
  const tiles = loaded?.key === key ? loaded.tiles : null;

  return (
    <>
      {error ? (
        <View style={styles.errorRow}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading past events"
            onPress={() => setAttempt((count) => count + 1)}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {tiles === null ? (
        error ? null : <ActivityIndicator color={colors.white} style={styles.loader} />
      ) : tiles.length === 0 ? (
        error ? null : <TileGridMessage message={emptyMessage} />
      ) : (
        <PhotoTileGrid tiles={tiles} onPressTile={onOpenEvent} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  errorRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center' },
  retry: {
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  retryText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.85 },
});
