import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PhotoTileGrid, TileGridMessage } from '@/components/PhotoTileGrid';
import { useAuth } from '@/features/auth/AuthContext';
import { pickChatPhotoFromLibrary } from '@/features/auth/profilePhoto';
import { formatEventDate, formatEventTime } from '@/features/events/eventTimes';
import {
  addMemory,
  Attendee,
  deleteMemory,
  fetchAttendees,
  fetchEvent,
  fetchMemories,
  Memory,
} from '@/features/events/pastEventService';
import type { MessagesStackParamList, ProfileStackParamList } from '@/navigation/types';
import { colors, fontFamily, gradientDirection, gradients, spacing, text } from '@/theme';
import type { MeetEvent } from '@/types/models';

// Opened from a past-event tile on either profile screen, so it lives in both stacks.
type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'PastEvent'>
  | NativeStackScreenProps<MessagesStackParamList, 'PastEvent'>;

// Events created in the app store the address as text; the shared model also allows { name, address }.
function locationText(location: unknown): string {
  if (typeof location === 'string') return location.trim();
  if (location && typeof location === 'object') {
    const { address, name } = location as { address?: unknown; name?: unknown };
    if (typeof address === 'string' && address.trim()) return address.trim();
    if (typeof name === 'string') return name.trim();
  }
  return '';
}

// Read-only details of an event that has ended, plus the photos attendees add to it.
export function PastEventScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { user } = useAuth();
  const [event, setEvent] = useState<MeetEvent | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memoriesError, setMemoriesError] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const loadSequence = useRef(0);
  // The refs block a second tap before React re-renders the disabled button.
  const uploadLock = useRef(false);
  const deleteLock = useRef(false);
  const mounted = useRef(false);
  const scrollView = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Sequence numbers keep a slower, older load from replacing a newer one.
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    setMemoriesError('');
    try {
      const loaded = await fetchEvent(eventId);
      if (sequence !== loadSequence.current) return;
      setEvent(loaded);
      if (!loaded) {
        setError('This event is unavailable.');
        return;
      }

      // Attendees and memories load independently; one failing should not hide the other.
      const [people, photos] = await Promise.allSettled([
        fetchAttendees(loaded.participantIds),
        fetchMemories(eventId),
      ]);
      if (sequence !== loadSequence.current) return;
      setAttendees(people.status === 'fulfilled' ? people.value : []);
      if (photos.status === 'fulfilled') {
        setMemories(photos.value);
      } else {
        console.error('Failed to load memories:', photos.reason);
        setMemoriesError('Could not load memories.');
      }
    } catch (cause) {
      if (sequence !== loadSequence.current) return;
      // The rules deny reading an event you were not invited to, so this covers that case too.
      console.error('Failed to load past event:', cause);
      setEvent(null);
      setError('Could not load this event. Please try again.');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    return () => { ++loadSequence.current; };
  }, [load]);

  // While a memory is open, Back returns to the event details instead of leaving.
  usePreventRemove(selectedMemoryId !== null, () => setSelectedMemoryId(null));

  const openMemory = (memoryId: string) => {
    setSelectedMemoryId(memoryId);
    setDeleteError('');
    scrollView.current?.scrollTo({ y: 0, animated: true });
  };

  const removeMemory = async (memoryId: string) => {
    if (deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMemory(eventId, memoryId);
      if (!mounted.current) return;
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
      // Clearing the selection also lets Back leave the screen again.
      setSelectedMemoryId((current) => (current === memoryId ? null : current));
    } catch (cause) {
      console.error('Failed to delete memory:', cause);
      if (mounted.current) setDeleteError('Could not delete your photo. Please try again.');
    } finally {
      deleteLock.current = false;
      if (mounted.current) setDeleting(false);
    }
  };

  const confirmDeleteMemory = (memoryId: string) => {
    if (deleteLock.current) return;
    const message = "This removes the photo from this event's memories for everyone.";
    // React Native Web's Alert does not show a dialog, so use the browser's confirmation there.
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void removeMemory(memoryId);
      return;
    }
    Alert.alert('Delete photo?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeMemory(memoryId) },
    ]);
  };

  const addPhoto = async () => {
    if (!user || !event || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setUploadError('');
    try {
      const picked = await pickChatPhotoFromLibrary();
      if (picked.error) {
        if (mounted.current) setUploadError(picked.error);
        return;
      }
      if (!picked.photo) return;
      const memory = await addMemory(eventId, user.uid, picked.photo.dataUrl);
      if (mounted.current) setMemories((current) => [memory, ...current]);
    } catch (cause) {
      console.error('Failed to add memory:', cause);
      if (mounted.current) setUploadError('Could not add your photo. Please try again.');
    } finally {
      uploadLock.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const title = event?.title || 'Untitled Event';
  const location = locationText(event?.location);
  const times = event ? { start: event.startAt.toDate(), end: event.endAt.toDate() } : null;
  const selectedMemory = memories.find((memory) => memory.id === selectedMemoryId) ?? null;
  // Only the person who posted a photo sees the delete button for it.
  const canDeleteSelected = !!selectedMemory && !!user && selectedMemory.uploaderId === user.uid;
  const memoryTiles = memories.map((memory, index) => ({
    id: memory.id,
    label: `Memory ${index + 1} of ${memories.length}`,
    photoUri: memory.photoDataUrl,
  }));

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedMemory ? 'Back to event' : 'Back'}
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
          {canDeleteSelected ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete this photo"
              accessibilityState={{ disabled: deleting, busy: deleting }}
              disabled={deleting}
              hitSlop={12}
              onPress={() => confirmDeleteMemory(selectedMemory.id)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="trash-outline" size={24} color={colors.red} />
              )}
            </Pressable>
          ) : null}
        </View>

        <ScrollView ref={scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={colors.white} style={styles.loader} />
          ) : !event || !times ? (
            <View style={styles.centered}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.cover}>
                {event.photoURL ? (
                  <Image source={{ uri: event.photoURL }} style={styles.coverImage} />
                ) : (
                  <Ionicons name="calendar-outline" size={40} color={colors.white} />
                )}
              </View>

              {selectedMemory ? (
                <>
                  <Text style={styles.title}>{title} Memories</Text>
                  <Image
                    accessibilityLabel={memoryTiles.find((tile) => tile.id === selectedMemory.id)?.label}
                    source={{ uri: selectedMemory.photoDataUrl }}
                    style={styles.selectedPhoto}
                    resizeMode="contain"
                  />
                  {deleteError ? (
                    <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.detail}>
                    {formatEventDate(times)}{'   '}{formatEventTime(times)}
                  </Text>
                  {location ? (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color={colors.white} />
                      <Text style={styles.detail}>{location}</Text>
                    </View>
                  ) : null}

                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Attendees</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.attendeeRow}
                    contentContainerStyle={styles.attendeeContent}
                    accessibilityLabel="Event attendees"
                  >
                    {attendees.map((attendee) => (
                      <View
                        key={attendee.id}
                        accessible
                        accessibilityLabel={attendee.displayName}
                        style={styles.attendee}
                      >
                        {attendee.photoUri ? (
                          <Image source={{ uri: attendee.photoUri }} style={styles.attendeePhoto} />
                        ) : (
                          <Ionicons name="person-outline" size={20} color={colors.white} />
                        )}
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.divider} />
                  <View style={styles.memoriesHeader}>
                    <Text style={styles.sectionTitle}>Memories</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add a photo to memories"
                      accessibilityState={{ disabled: uploading, busy: uploading }}
                      disabled={uploading}
                      hitSlop={12}
                      onPress={() => void addPhoto()}
                      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Ionicons name="add" size={20} color={colors.white} />
                      )}
                    </Pressable>
                  </View>
                  {uploadError ? (
                    <Text accessibilityRole="alert" style={styles.error}>{uploadError}</Text>
                  ) : null}
                </>
              )}

              {memoriesError ? (
                <Text accessibilityRole="alert" style={styles.error}>{memoriesError}</Text>
              ) : memoryTiles.length > 0 ? (
                <PhotoTileGrid
                  tiles={memoryTiles}
                  onPressTile={openMemory}
                  selectedId={selectedMemoryId}
                  style={styles.memoryGrid}
                />
              ) : (
                <TileGridMessage message="No memories yet. Tap + to add the first photo." />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default PastEventScreen;

const COVER_SIZE = 99;
const AVATAR_SIZE = 52;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loader: { marginTop: spacing.xxl },
  centered: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: COVER_SIZE / 2,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.cardDarker,
  },
  coverImage: { width: '100%', height: '100%' },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 23,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  detail: { ...text.body, color: colors.white, textAlign: 'center', marginTop: spacing.xs },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.primaryAccent,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...text.body, fontSize: 16, color: colors.white },
  attendeeRow: { marginTop: spacing.md },
  attendeeContent: { gap: 10, paddingHorizontal: 2 },
  attendee: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attendeePhoto: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  memoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPhoto: {
    width: '100%',
    aspectRatio: 1,
    marginTop: spacing.lg,
  },
  memoryGrid: { paddingHorizontal: 0 },
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center', marginTop: spacing.md },
  retry: {
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  retryText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.85 },
});
