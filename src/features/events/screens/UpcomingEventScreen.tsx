
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, onSnapshot, type Timestamp } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { saveEventPlanningDraft } from '@/features/events/eventEditingService';

import { ScreenHeader } from '@/components/ScreenHeader';
import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, fontFamily, gradients, gradientDirection } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';
import type { EventItem, EventTask } from '@/types/models';
import { formatEventDate, formatEventTime } from '@/features/events/eventTimes';

type Props = NativeStackScreenProps<AppStackParamList, 'EventDetails'>;

type SavedEvent = {
  title: string;
  category?: string;
  description?: string;
  location?: string;
  startAt: Timestamp;
  endAt: Timestamp;
  photoURL?: string | null;
  participantIds?: string[];
  creatorId?: string;
  groupId?: string | null;
  reminderMinutesBefore?: number | null;
  items?: EventItem[];
  tasks?: EventTask[];
};

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionHeadingText}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// Compare Firestore maps by value rather than property insertion order.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().filter(key => obj[key] !== undefined).map(key => [key, canonical(obj[key])]));
  }
  return value;
};
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export function UpcomingEventScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { user } = useAuth();

  const [event, setEvent] = useState<SavedEvent | null>(null);
  const [draftItems, setDraftItems] = useState<EventItem[]>([]);
  const [draftTasks, setDraftTasks] = useState<EventTask[]>([]);
  const originalRef = useRef<{items: EventItem[]; tasks: EventTask[]} | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attendeeNames, setAttendeeNames] = useState<Record<string, string>>({});
  const [groupAdminIds, setGroupAdminIds] = useState<string[]>([]);
  const [assignmentEntry, setAssignmentEntry] = useState<{type: 'item' | 'task'; id: number} | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<{type: 'item' | 'task'; id: number} | null>(null);
  const [pressedEntry, setPressedEntry] = useState<{type: 'item' | 'task'; id: number} | null>(null);
  const [attendeePhotos, setAttendeePhotos] = useState<
    Record<string, string | null>
  >({});

  const [addType, setAddType] = useState<'item' | 'task' | null>(null);
const [newName, setNewName] = useState('');
const [newPrice, setNewPrice] = useState('');
const [saving, setSaving] = useState(false);
const [saveDiagnostic, setSaveDiagnostic] = useState<string | null>(null);

const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
const [editedPrice, setEditedPrice] = useState('');

const isPast = !!event && event.endAt.toDate().getTime() <= Date.now();
const isAdmin = !!user && (event?.groupId ? groupAdminIds.includes(user.uid) : event?.creatorId === user.uid);
const canEdit = !!user && !isPast && (event?.participantIds ?? []).includes(user.uid);
const canManage = canEdit && isAdmin;
const markChanged = () => { dirtyRef.current = true; setDirty(true); setSaveDiagnostic(null); };
const updateDraft = (type: 'item' | 'task', update: (entries: any[]) => any[]) => {
  if (type === 'item') setDraftItems(previous => update(previous));
  else setDraftTasks(previous => update(previous));
  markChanged();
};

const closeAddModal = () => {
  if (saving) return;
  setAddType(null);
  setNewName('');
  setNewPrice('');
};

const handleAddEntry = () => {
  if (!canManage || !addType || saving) return;
  const name = newName.trim();
  if (!name) { Alert.alert('Missing Name', 'Please enter a name.'); return; }
  const price = Number(newPrice.trim());
  if (addType === 'item' && (!newPrice.trim() || !Number.isFinite(price) || price < 0)) {
    Alert.alert('Invalid Price', 'Enter a valid price of $0 or more.'); return;
  }
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (addType === 'item') updateDraft('item', entries => [...entries, {id, name, price, completed: false, assigneeId: null}]);
  else updateDraft('task', entries => [...entries, {id, name, completed: false, assigneeId: null}]);
  closeAddModal();
};

const handleToggle = (type: 'item' | 'task', id: number) => {
  if (!canManage || saving) return;
  updateDraft(type, entries => entries.map(entry => entry.id === id ? {...entry, completed: !entry.completed} : entry));
};

const openPriceEditor = (item: EventItem) => {
  if (!canManage) return;
  setEditingPriceId(item.id);
  setEditedPrice(item.price.toFixed(2));
};
const closePriceEditor = () => {
  if (saving) return;
  setEditingPriceId(null);
  setEditedPrice('');
};
const saveEditedPrice = () => {
  if (!canManage || editingPriceId === null || saving) return;
  const price = Number(editedPrice.trim());
  if (!editedPrice.trim() || !Number.isFinite(price) || price < 0) {
    Alert.alert('Invalid Price', 'Enter a valid price of $0 or more.'); return;
  }
  updateDraft('item', entries => entries.map(entry => entry.id === editingPriceId ? {...entry, price} : entry));
  closePriceEditor();
};

const handleSave = async () => {
  if (!user || !canEdit || !dirty || saving) return;
  if (conflict) { Alert.alert('Event Updated', 'Someone else changed this event. Go back and reopen it before editing.'); return; }
  setSaveDiagnostic(null);
  setSaving(true);
  try {
    console.log('[UpcomingEvent] Save started', {eventId, itemCount: draftItems.length, taskCount: draftTasks.length});
    await saveEventPlanningDraft(eventId, user.uid, {
      items: draftItems, tasks: draftTasks,
      originalItems: originalRef.current?.items ?? [],
      originalTasks: originalRef.current?.tasks ?? [],
    });
    console.log('[UpcomingEvent] Firebase transaction completed successfully');
    originalRef.current = {items: draftItems, tasks: draftTasks};
    dirtyRef.current = false;
    setDirty(false);
    navigation.goBack();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : 'unknown';
    console.error('[UpcomingEvent] Save failed:', {code, detail, error: err});
    setSaveDiagnostic(`Save failed (${code}): ${detail}`);
    Alert.alert('Unable to Save', detail);
  } finally { setSaving(false); }
};

  useEffect(() => {
    return onSnapshot(
      doc(db, 'events', eventId),
      (snapshot) => {
        const latest = snapshot.exists() ? (snapshot.data() as SavedEvent) : null;
        setEvent(latest);
        if (!dirtyRef.current) {
          setDraftItems(latest?.items ?? []);
          setDraftTasks(latest?.tasks ?? []);
          originalRef.current = latest ? {items: latest.items ?? [], tasks: latest.tasks ?? []} : null;
          setConflict(false);
        } else if (latest && originalRef.current &&
          (!same(latest.items ?? [], originalRef.current.items) ||
           !same(latest.tasks ?? [], originalRef.current.tasks))) {
          setConflict(true);
        }
        setLoading(false);
        setError(false);
      },
      (snapshotError) => {
        console.error('Unable to load event:', snapshotError);
        setLoading(false);
        setError(true);
      }
    );
  }, [eventId]);

  useEffect(() => {
    if (!event) return;

    let active = true;
    const ids = event.participantIds ?? [];

    Promise.all(
      ids.map(async (id) => {
        try {
          const snapshot = await getDoc(doc(db, 'publicProfiles', id));
          const profile = snapshot.data();
          return [id, profile?.photoDataUrl ?? profile?.photoURL ?? null, profile?.displayName ?? profile?.name ?? null] as const;
        } catch {
          return [id, null, null] as const;
        }
      })
    ).then((results) => {
      if (active) {
        setAttendeePhotos(Object.fromEntries(results.map(([id, photo]) => [id, photo])));
        setAttendeeNames(Object.fromEntries(results.map(([id, , name]) => [id, name || (id === user?.uid ? user?.displayName || 'My account' : 'Another member')])));
      }
    });

    return () => {
      active = false;
    };
  }, [event?.participantIds, user?.uid, user?.displayName]);

  useEffect(() => {
    if (!event?.groupId) { setGroupAdminIds([]); return; }
    return onSnapshot(doc(db, 'groups', event.groupId), snapshot => {
      const ids = snapshot.data()?.adminIds;
      setGroupAdminIds(Array.isArray(ids) ? ids : []);
    }, () => setGroupAdminIds([]));
  }, [event?.groupId]);

  const getEntry = (entry: {type: 'item' | 'task'; id: number} | null) =>
    entry ? (entry.type === 'item' ? draftItems : draftTasks).find(e => e.id === entry.id) : undefined;
  const assignmentTarget = getEntry(assignmentEntry);
  const deleteTarget = getEntry(deleteEntry);
  const getAssigneeName = (id: string | null) => !id ? 'Not assigned yet' : attendeeNames[id] || (id === user?.uid ? user?.displayName || 'My account' : 'Another member');

  const handleAssignment = (assigneeId: string | null) => {
    if (!user || !assignmentEntry || !canEdit || saving) return;
    const entry = getEntry(assignmentEntry);
    if (!entry) return;
    if (assigneeId !== null && !(event?.participantIds ?? []).includes(assigneeId)) return;
    if (!isAdmin && !((entry.assigneeId == null && assigneeId === user.uid) ||
      (entry.assigneeId === user.uid && assigneeId === null))) return;
    updateDraft(assignmentEntry.type, entries => entries.map(e => e.id === assignmentEntry.id ? {...e, assigneeId} : e));
    setAssignmentEntry(null);
  };

  const handleDeleteEntry = () => {
    if (!deleteEntry || !canManage || saving) return;
    updateDraft(deleteEntry.type, entries => entries.filter(e => e.id !== deleteEntry.id));
    setDeleteEntry(null);
  };

  const renderAvatar = (type: 'item' | 'task', id: number, assigneeId: string | null) => (
    <View style={styles.planningCenter}>
      <Pressable style={styles.assigneePlaceholder} disabled={saving || !canEdit} onPress={() => setAssignmentEntry({type, id})}
        accessibilityRole="button" accessibilityLabel={`View assignment for ${type}`}>
        {assigneeId && attendeePhotos[assigneeId] ? (
          <Image source={{uri: attendeePhotos[assigneeId]!}} style={styles.assigneePhoto} />
        ) : (
          <Ionicons name={assigneeId === user?.uid ? 'checkmark' : 'person-outline'} size={18} color={colors.white} />
        )}
      </Pressable>
    </View>
  );

  const items = draftItems;
  const tasks = draftTasks;
  const total = items.reduce((sum, item) => sum + item.price, 0);

  const eventTimes = event
    ? { start: event.startAt.toDate(), end: event.endAt.toDate() }
    : null;

  const reminderLabel = (() => {
    switch (event?.reminderMinutesBefore) {
      case 30: return '30 minutes before';
      case 60: return '1 hour before';
      case 120: return '2 hours before';
      case 1440: return '24 hours before';
      default: return 'No reminder';
    }
  })();

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradients.background}
        start={gradientDirection.vertical.start}
        end={gradientDirection.vertical.end}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.saveHeader}>
        <Pressable onPress={() => navigation.goBack()} disabled={saving} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={28} color={colors.white} />
        </Pressable>
        <Text style={styles.saveHeaderTitle}>{isPast ? 'Event Details' : 'Upcoming Event'}</Text>
        <Pressable onPress={handleSave} disabled={!dirty || !canEdit || saving} accessibilityLabel="Save changes">
          <Text style={[styles.saveHeaderAction, (!dirty || !canEdit || saving) && styles.saveHeaderDisabled]}>{saving ? 'Saving' : 'Save'}</Text>
        </Pressable>
      </View>

      {saveDiagnostic ? (
        <View style={styles.saveDiagnosticBox}>
          <Text style={styles.saveDiagnosticText} selectable>{saveDiagnostic}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator
          style={styles.centered}
          color={colors.primaryAccent}
        />
      ) : error || !event || !eventTimes ? (
        <View style={styles.centered}>
          <Ionicons
            name="calendar-outline"
            size={48}
            color={colors.white}
          />
          <Text style={styles.eventTitle}>
            {error ? 'Unable to Load Event' : 'Event No Longer Available'}
          </Text>
          <Text style={styles.emptyText}>
            {error
              ? 'Please try again later.'
              : 'This event has been deleted or no longer exists.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* EVENT PHOTO */}
          <View style={styles.photoContainer}>
            <View style={styles.photoCircle}>
              {event.photoURL ? (
                <Image
                  source={{ uri: event.photoURL }}
                  style={styles.eventPhoto}
                />
              ) : (
                <Ionicons
                  name="camera-outline"
                  size={44}
                  color={colors.white}
                />
              )}
            </View>
          </View>

          <Text style={styles.eventTitle}>
            {event.title || 'Untitled Event'}
          </Text>

          {/* EVENT INFO: SAME TWO-COLUMN LAYOUT */}
          <View style={styles.eventInfo}>
            <View style={styles.eventInfoLeft}>
              <Text style={styles.eventInfoText}>
                {event.category || 'No Category'}
              </Text>

              <Text style={styles.eventInfoText}>
                {formatEventDate(eventTimes)}
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.eventInfoRight}>
              <View style={styles.infoRow}>
                <Ionicons
                  name="location-outline"
                  size={19}
                  color={colors.white}
                />
                <Text style={styles.eventInfoText}>
                  {event.location || 'Location not selected'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="time-outline"
                  size={19}
                  color={colors.white}
                />
                <Text style={styles.eventInfoText}>
                  {formatEventTime(eventTimes)}
                </Text>
              </View>
            </View>
          </View>

          {/* DESCRIPTION */}
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>
              {event.description || 'Event Description...'}
            </Text>
          </View>

          {/* ATTENDEES */}
          <Text style={styles.sectionHeadingText}>Attendees</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.attendeeRow}
            contentContainerStyle={styles.attendeeContent}
          >
            {(event.participantIds ?? []).map((id) => {
              const photo = attendeePhotos[id];

              return (
                <View key={id} style={styles.attendeeAvatar}>
                  {photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={styles.attendeePhoto}
                    />
                  ) : (
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={colors.white}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* REMINDER */}
          <View style={styles.reminderContainer}>
            <View style={styles.reminderButton}>
              <Text style={styles.reminderText}>
                Reminder: {reminderLabel}
              </Text>
              <Ionicons
                name="notifications-outline"
                size={21}
                color={colors.white}
              />
            </View>
          </View>

          {/* ITEMS */}
          <SectionHeading title="Items" />

          {items.map((item) => (
            <Pressable key={item.id} style={[styles.planningRow, pressedEntry?.type === 'item' && pressedEntry.id === item.id && styles.planningRowPressed]}
              onPressIn={() => setPressedEntry({type: 'item', id: item.id})} onPressOut={() => setPressedEntry(null)}
              onLongPress={() => { if (!canManage) return; setPressedEntry(null); setDeleteEntry({type: 'item', id: item.id}); }} delayLongPress={450} disabled={saving}>
              <View style={styles.planningLeft}>
                <Text
                  style={[
                    styles.planningTitle,
                    item.completed && styles.completedText,
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
              </View>

              {renderAvatar('item', item.id, item.assigneeId)}

              <View style={styles.planningRight}>
                <Pressable
                    onPress={() => openPriceEditor(item)}
                    disabled={saving || !canManage}
                    accessibilityLabel={`Edit price for ${item.name}`}
                    >
                    <Text style={styles.planningPrice}>
                        ${item.price.toFixed(2)}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => handleToggle('item', item.id)}
                    disabled={saving || !canManage}
                    accessibilityLabel={`Toggle ${item.name}`}
                    >
                    <Ionicons
                        name={item.completed ? 'checkbox-outline' : 'square-outline'}
                        size={27}
                        color={colors.white}
                    />
                    </Pressable>
              </View>
            </Pressable>
          ))}

          {canManage && <Pressable
            style={styles.addButton}
            accessibilityLabel="Add item"
            onPress={() => setAddType('item')}
            >
            <Ionicons name="add" size={32} color={colors.white} />
            </Pressable>}

          <Text style={styles.totalText}>
            Total: ${total.toFixed(2)}
          </Text>

          {/* TASKS */}
          <SectionHeading title="Tasks" />

          {tasks.map((task) => (
            <Pressable key={task.id} style={[styles.planningRow, pressedEntry?.type === 'task' && pressedEntry.id === task.id && styles.planningRowPressed]}
              onPressIn={() => setPressedEntry({type: 'task', id: task.id})} onPressOut={() => setPressedEntry(null)}
              onLongPress={() => { if (!canManage) return; setPressedEntry(null); setDeleteEntry({type: 'task', id: task.id}); }} delayLongPress={450} disabled={saving}>
              <View style={styles.planningLeft}>
                <Text
                  style={[
                    styles.planningTitle,
                    task.completed && styles.completedText,
                  ]}
                  numberOfLines={2}
                >
                  {task.name}
                </Text>
              </View>

              {renderAvatar('task', task.id, task.assigneeId)}

              <View style={styles.planningRight}>
                <Pressable
                    onPress={() => handleToggle('task', task.id)}
                    disabled={saving || !canManage}
                    accessibilityLabel={`Toggle ${task.name}`}
                    >
                    <Ionicons
                        name={task.completed ? 'checkbox-outline' : 'square-outline'}
                        size={27}
                        color={colors.white}
                    />
                    </Pressable>
              </View>
            </Pressable>
          ))}

          {canManage && <Pressable
            style={styles.addButton}
            accessibilityLabel="Add task"
            onPress={() => setAddType('task')}
            >
            <Ionicons name="add" size={32} color={colors.white} />
            </Pressable>}

          {/* DELETE EVENT: FUNCTIONALITY COMES LATER */}
          <View style={styles.deleteButton}>
            <Ionicons
              name="trash-outline"
              size={25}
              color={colors.red}
            />
            <Text style={styles.deleteText}>Delete Event</Text>
          </View>
        </ScrollView>
      )}
      <Modal
        visible={addType !== null}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
        >
        <View style={styles.editModalOverlay}>
            <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>
                Add {addType === 'item' ? 'Item' : 'Task'}
            </Text>

            <TextInput
                style={styles.editModalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Name"
                placeholderTextColor="#AAAAAA"
                maxLength={150}
            />

            {addType === 'item' && (
                <TextInput
                style={styles.editModalInput}
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="Price ($)"
                placeholderTextColor="#AAAAAA"
                keyboardType="decimal-pad"
                />
            )}

            <View style={styles.editModalActions}>
                <Pressable
                style={styles.editModalCancelButton}
                onPress={closeAddModal}
                disabled={saving}
                >
                <Text style={styles.editModalButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                style={styles.editModalSaveButton}
                onPress={handleAddEntry}
                disabled={saving}
                >
                <Text style={styles.editModalButtonText}>
                    {saving ? 'Saving...' : 'Save'}
                </Text>
                </Pressable>
            </View>
            </View>
        </View>
        </Modal>

        <Modal
            visible={editingPriceId !== null}
            transparent
            animationType="fade"
            onRequestClose={closePriceEditor}
            >
            <View style={styles.editModalOverlay}>
                <View style={styles.editModalCard}>
                <Text style={styles.editModalTitle}>Edit Item Price</Text>

                <TextInput
                    style={styles.editModalInput}
                    value={editedPrice}
                    onChangeText={setEditedPrice}
                    placeholder="Price ($)"
                    placeholderTextColor="#AAAAAA"
                    keyboardType="decimal-pad"
                />

                <View style={styles.editModalActions}>
                    <Pressable
                    style={styles.editModalCancelButton}
                    onPress={closePriceEditor}
                    disabled={saving}
                    >
                    <Text style={styles.editModalButtonText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                    style={styles.editModalSaveButton}
                    onPress={saveEditedPrice}
                    disabled={saving}
                    >
                    <Text style={styles.editModalButtonText}>
                        {saving ? 'Saving...' : 'Save'}
                    </Text>
                    </Pressable>
                </View>
                </View>
            </View>
        </Modal>

      {/* Assignment modal: same layout as Review Event, plus admin member selection. */}
      <Modal visible={assignmentEntry !== null} transparent animationType="fade" onRequestClose={() => { if (!saving) setAssignmentEntry(null); }}>
        <Pressable style={styles.editModalOverlay} onPress={() => { if (!saving) setAssignmentEntry(null); }}>
          <Pressable style={styles.editModalCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.editModalTitle}>{assignmentTarget?.name}</Text>
            <View style={styles.assignmentProfile}>
              <View style={styles.assignmentAvatar}>
                {assignmentTarget?.assigneeId && attendeePhotos[assignmentTarget.assigneeId] ?
                  <Image source={{uri: attendeePhotos[assignmentTarget.assigneeId]!}} style={styles.assignmentPhoto} /> :
                  <Ionicons name="person-outline" size={32} color={colors.white} />}
              </View>
              <Text style={styles.assignmentLabel}>Assigned to</Text>
              <Text style={styles.assignmentName}>{getAssigneeName(assignmentTarget?.assigneeId ?? null)}</Text>
            </View>
            {canEdit && assignmentTarget?.assigneeId === user?.uid ? (
              <Pressable style={styles.assignmentOption} disabled={saving} onPress={() => handleAssignment(null)}>
                <Ionicons name="person-remove-outline" size={22} color={colors.white} />
                <Text style={styles.editModalButtonText}>Unassign myself</Text>
              </Pressable>
            ) : canEdit && !assignmentTarget?.assigneeId ? (
              <Pressable style={styles.assignmentOption} disabled={saving || !user} onPress={() => handleAssignment(user!.uid)}>
                <Ionicons name="person-add-outline" size={22} color={colors.white} />
                <Text style={styles.editModalButtonText}>Assign to myself</Text>
              </Pressable>
            ) : !isAdmin ? <Text style={styles.assignmentLabel}>This is assigned to another member.</Text> : null}
            {canManage && (
              <>
                <Text style={styles.assignmentLabel}>Assign to a participant</Text>
                <ScrollView style={styles.memberList} nestedScrollEnabled>
                  {(event?.participantIds ?? []).map(id => (
                    <Pressable key={id} style={styles.memberOption} disabled={saving || assignmentTarget?.assigneeId === id}
                      onPress={() => handleAssignment(id)}>
                      <View style={styles.memberAvatar}>
                        {attendeePhotos[id] ? <Image source={{uri: attendeePhotos[id]!}} style={styles.memberAvatarPhoto} /> :
                          <Ionicons name="person-outline" size={20} color={colors.white} />}
                      </View>
                      <Text style={styles.memberName}>{getAssigneeName(id)}</Text>
                      {assignmentTarget?.assigneeId === id && <Ionicons name="checkmark" size={20} color={colors.white} />}
                    </Pressable>
                  ))}
                </ScrollView>
                {!!assignmentTarget?.assigneeId && (
                  <Pressable style={styles.assignmentOption} disabled={saving} onPress={() => handleAssignment(null)}>
                    <Ionicons name="person-remove-outline" size={22} color={colors.white} />
                    <Text style={styles.editModalButtonText}>Unassign member</Text>
                  </Pressable>
                )}
              </>
            )}
            <Pressable style={styles.assignmentCancelButton} disabled={saving || !canEdit} onPress={() => setAssignmentEntry(null)}>
              <Text style={styles.editModalButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Long-press delete modal, matching Review Event. */}
      <Modal visible={deleteEntry !== null} transparent animationType="fade" onRequestClose={() => { if (!saving) setDeleteEntry(null); }}>
        <Pressable style={styles.editModalOverlay} onPress={() => { if (!saving) setDeleteEntry(null); }}>
          <Pressable style={styles.editModalCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.editModalTitle}>{deleteTarget?.name}</Text>
            <Pressable style={styles.deleteOption} disabled={saving || !canManage} onPress={handleDeleteEntry}>
              <Ionicons name="trash-outline" size={22} color={colors.red} />
              <Text style={styles.deleteOptionText}>{saving ? 'Deleting...' : `Delete ${deleteEntry?.type}`}</Text>
            </Pressable>
            <Pressable style={styles.assignmentCancelButton} disabled={saving} onPress={() => setDeleteEntry(null)}>
              <Text style={styles.editModalButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  saveHeader: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  saveHeaderTitle: { fontSize: 21, fontWeight: '700', color: colors.white },
  saveHeaderAction: { fontSize: 19, color: colors.primaryAccent },
  saveHeaderDisabled: { opacity: 0.35 },
  saveDiagnosticBox: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 8, backgroundColor: '#54232C' },
  saveDiagnosticText: { color: '#FFFFFF', fontSize: 13 },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 21,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyText: {
    color: colors.white,
    opacity: 0.7,
    textAlign: 'center',
  },
  photoContainer: {
    width: 113,
    height: 113,
    alignSelf: 'center',
    marginTop: 22,
    marginBottom: 14,
  },
  photoCircle: {
    width: 113,
    height: 113,
    borderRadius: 57,
    backgroundColor: colors.cardDarker,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  eventPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 57,
  },
  eventTitle: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 23,
    textAlign: 'center',
    marginBottom: 26,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    minHeight: 65,
    marginBottom: 27,
  },
  eventInfoLeft: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 15,
  },
  infoDivider: {
    width: 1,
    height: 64,
    backgroundColor: colors.cardLighter,
    marginHorizontal: 22,
  },
  eventInfoRight: {
    flex: 1.1,
    justifyContent: 'space-between',
    gap: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventInfoText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    flexShrink: 1,
  },
  descriptionBox: {
    minHeight: 168,
    borderRadius: 19,
    backgroundColor: colors.cardDarker,
    padding: 13,
    marginBottom: 12,
  },
  descriptionText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 16,
  },
  attendeeRow: {
    marginTop: 10,
    marginBottom: 18,
  },
  attendeeContent: {
    gap: 10,
    paddingHorizontal: 2,
  },
  attendeeAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attendeePhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  reminderContainer: {
    marginBottom: 12,
  },
  reminderButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 17,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 12,
  },
  sectionHeadingText: {
    fontFamily: fontFamily.regular,
    fontSize: 17,
    color: colors.white,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardLighter,
  },
  planningRow: {
    minHeight: 60,
    borderRadius: 18,
    backgroundColor: colors.cardLighter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  planningLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  planningCenter: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planningRight: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  planningTitle: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    flexShrink: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  assigneePlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  planningPrice: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 17,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  deleteButton: {
    height: 59,
    borderRadius: 15,
    backgroundColor: colors.cardLighter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 20,
    marginTop: 12,
  },
  deleteText: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    color: colors.red,
  },

  // Modal styling matches ReviewEventScreen.
  planningRowPressed: {
    transform: [{ scale: 1.025 }], elevation: 9, shadowColor: '#000',
    shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.3, shadowRadius: 10, zIndex: 2,
  },
  assigneePhoto: {width: 34, height: 34, borderRadius: 17},
  assignmentProfile: {alignItems: 'center', gap: 7, paddingVertical: 8},
  assignmentAvatar: {width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primaryAccent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6},
  assignmentPhoto: {width: 62, height: 62, borderRadius: 31},
  assignmentLabel: {color: colors.white, fontFamily: fontFamily.regular, fontSize: 14, opacity: 0.75, textAlign: 'center'},
  assignmentName: {color: colors.white, fontFamily: fontFamily.semibold, fontSize: 17, textAlign: 'center'},
  assignmentOption: {backgroundColor: colors.primaryAccent, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12},
  assignmentCancelButton: {height: 46, borderRadius: 12, backgroundColor: colors.cardLighter, alignItems: 'center', justifyContent: 'center'},
  deleteOption: {backgroundColor: colors.cardLighter, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12},
  deleteOptionText: {color: colors.red, fontFamily: fontFamily.semibold, fontSize: 16},
  memberList: {maxHeight: 210},
  memberOption: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9},
  memberAvatar: {width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryAccent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  memberAvatarPhoto: {width: 36, height: 36, borderRadius: 18},
  memberName: {color: colors.white, fontFamily: fontFamily.regular, fontSize: 15, flex: 1},
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  editModalCard: {
    backgroundColor: colors.cardDarker,
    borderRadius: 22,
    padding: 22,
    gap: 16,
  },
  editModalTitle: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 21,
    textAlign: 'center',
  },
  editModalInput: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.cardLighter,
    paddingHorizontal: 15,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editModalCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.cardLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalSaveButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalButtonText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },
});
