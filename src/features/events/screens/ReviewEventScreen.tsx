
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { doc, getDoc } from 'firebase/firestore';

import { ScreenHeader } from '@/components/ScreenHeader';
import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import {
  pickPhotoFromLibrary,
  takeProfilePhoto,
} from '@/features/auth/profilePhoto';
import {
  colors,
  fontFamily,
  gradients,
  gradientDirection,
} from '@/theme';
import type { UserProfile } from '@/types/models';
import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';
import {
  formatEventDate,
  formatEventTime,
} from '@/features/events/eventTimes';
import { EditPhoto } from '@/components/EditPhoto';

import { createEvent } from '@/features/events/eventService';
import { createGroup } from '@/features/messages/groups';
import { CommonActions } from '@react-navigation/native';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'ReviewEvent'
>;

type EventItem = {
  id: number;
  name: string;
  price: number;
  completed: boolean;
  assigneeId: string | null;
};

type EventTask = {
  id: number;
  name: string;
  completed: boolean;
  assigneeId: string | null;
};

type AddType = 'item' | 'task';

type SelectedEntry = {
  type: AddType;
  id: number;
};

export function ReviewEventScreen({ navigation, route }: Props) {
  const {
    eventName,
    category,
    startAt,
    endAt,
    eventPhoto: initialEventPhoto,
    selectedMemberIds = [],
    location,
  } = route.params;
  const eventTimes = {
    start: new Date(startAt),
    end: new Date(endAt),
  };
  const { user } = useAuth();

  console.log('REVIEW EVENT PHOTO CHECK:', {
  receivedPhoto: !!initialEventPhoto,
  photoLength: initialEventPhoto?.length ?? 0,
  photoPrefix: initialEventPhoto?.slice(0, 30),
});

  const [eventPhoto, setEventPhoto] = useState<string | null>(
  initialEventPhoto ?? null
);

  const [eventPhotoDataUrl, setEventPhotoDataUrl] = useState<string | null>(
  initialEventPhoto?.startsWith('data:image/')
    ? initialEventPhoto
    : null
);

  const [photoLoading, setPhotoLoading] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  const [description, setDescription] = useState('');
  const [reminder, setReminder] = useState('24 hours before');
  const [reminderOpen, setReminderOpen] = useState(false);

  const [items, setItems] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);

  const [modalType, setModalType] = useState<AddType | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  const [assignmentEntry, setAssignmentEntry] =
    useState<SelectedEntry | null>(null);

  const [deleteEntry, setDeleteEntry] =
    useState<SelectedEntry | null>(null);

  const [pressedEntry, setPressedEntry] =
    useState<SelectedEntry | null>(null);

  useEffect(() => {
    if (!user) {
      setMyProfile(null);
      return;
    }

    let active = true;

    getDoc(doc(db, 'users', user.uid))
      .then((snapshot) => {
        if (!active) return;

        setMyProfile(
          snapshot.exists()
            ? ({ ...snapshot.data(), id: snapshot.id } as UserProfile)
            : null
        );
      })
      .catch(() => {
        if (active) setMyProfile(null);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const myPhoto =
    myProfile?.photoDataUrl ??
    myProfile?.photoURL ??
    user?.photoURL;

  const myName =
    myProfile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    'My account';

  const total = items.reduce(
    (sum, item) => sum + item.price,
    0
  );

  const formatPrice = (price: number) =>
    `$${price.toFixed(2)}`;

  // EVENT PHOTO FUNCTIONS

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
      setEventPhoto(result.photo.uri);
      setEventPhotoDataUrl(result.photo.dataUrl);
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

    // Match Edit Profile's behavior on Expo Web.
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
                onPress: () => {
                  setEventPhoto(null);
                  setEventPhotoDataUrl(null);
                },
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

  // ITEM / TASK HELPERS

  const getEntry = (selection: SelectedEntry | null) => {
    if (!selection) return null;

    if (selection.type === 'item') {
      return items.find((item) => item.id === selection.id) ?? null;
    }

    return tasks.find((task) => task.id === selection.id) ?? null;
  };

  const assignmentTarget = getEntry(assignmentEntry);
  const deleteTarget = getEntry(deleteEntry);

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return 'Not assigned yet';
    if (assigneeId === user?.uid) return myName;
    return 'Another member';
  };

  const isPressed = (type: AddType, id: number) =>
    pressedEntry?.type === type && pressedEntry.id === id;

  const openAddModal = (type: AddType) => {
    setNewName('');
    setNewPrice('');
    setModalType(type);
  };

  const closeAddModal = () => {
    setModalType(null);
    setNewName('');
    setNewPrice('');
  };

  const handleAdd = () => {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      Alert.alert(
        'Missing Name',
        `Please enter a ${
          modalType === 'item' ? 'name for the item' : 'task name'
        }.`
      );
      return;
    }

    if (modalType === 'item') {
      const price = Number(newPrice.trim());

      if (
        !newPrice.trim() ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        Alert.alert(
          'Invalid Price',
          'Enter a valid price of $0 or more.'
        );
        return;
      }

      setItems((current) => [
        ...current,
        {
          id: Date.now(),
          name: trimmedName,
          price,
          completed: false,
          assigneeId: null,
        },
      ]);
    } else if (modalType === 'task') {
      setTasks((current) => [
        ...current,
        {
          id: Date.now(),
          name: trimmedName,
          completed: false,
          assigneeId: null,
        },
      ]);
    }

    closeAddModal();
  };

  const toggleItem = (id: number) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  };

  const toggleTask = (id: number) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  };

  const updateAssignment = (assign: boolean) => {
    if (!user || !assignmentEntry) return;

    const update = <
      T extends { id: number; assigneeId: string | null }
    >(
      entries: T[]
    ): T[] =>
      entries.map((entry) => {
        if (entry.id !== assignmentEntry.id) return entry;

        if (assign && entry.assigneeId === null) {
          return { ...entry, assigneeId: user.uid };
        }

        if (!assign && entry.assigneeId === user.uid) {
          return { ...entry, assigneeId: null };
        }

        return entry;
      });

    if (assignmentEntry.type === 'item') {
      setItems((current) => update(current));
    } else {
      setTasks((current) => update(current));
    }

    setAssignmentEntry(null);
  };

  const openDeleteConfirmation = () => {
  if (!deleteEntry) return;

  const { type, id } = deleteEntry;

  if (type === 'item') {
    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  } else {
    setTasks((current) =>
      current.filter((task) => task.id !== id)
    );
  }

  setDeleteEntry(null);
};

  const renderAvatar = (
    type: AddType,
    id: number,
    assigneeId: string | null
  ) => (
    <View style={styles.planningCenter}>
      <Pressable
        style={styles.assigneePlaceholder}
        onPress={() => setAssignmentEntry({ type, id })}
        accessibilityRole="button"
        accessibilityLabel={`View assignment for ${type}`}
      >
        {assigneeId === user?.uid && myPhoto ? (
          <Image
            source={{ uri: myPhoto }}
            style={styles.assigneePhoto}
          />
        ) : (
          <Ionicons
            name={
              assigneeId === user?.uid
                ? 'checkmark'
                : 'person-outline'
            }
            size={18}
            color={colors.white}
          />
        )}
      </Pressable>
    </View>
  );

  

  const handleConfirmEvent = async () => {
  console.log('STEP 1: Confirm Event pressed', {
    userId: user?.uid,
    savingEvent,
  });

  if (!user || savingEvent) return;

  try {
setSavingEvent(true);

const participantIds = [...new Set([
  user.uid,
  ...selectedMemberIds,
])].sort();

console.log('EVENT PARTICIPANTS:', {
  currentUser: user.uid,
  selectedMemberIds,
  participantIds,
});

let groupId: string | null = null;

if (participantIds.length > 1) {
  const friendIds = participantIds.filter(
    (id) => id !== user.uid
  );
  console.log('STEP 2: Creating or finding group');

  const group = await createGroup(user.uid, friendIds);
  groupId = group.id;
}

const eventId = await createEvent({
  creatorId: user.uid,
  title: eventName,
  category,
  description,
  location: location ?? '',
  photoURL: eventPhotoDataUrl,
  startAt,
  endAt,
  groupId,
  participantIds,
  items,
  tasks,
  reminderMinutesBefore: {
    '30 minutes before': 30,
    '1 hour before': 60,
    '2 hours before': 120,
    '24 hours before': 1440,
  }[reminder] ?? null,
});

if (groupId) {
  navigation.getParent()?.navigate('Messages', {
    screen: 'Conversation',
    params: {
      kind: 'group',
      title: eventName,
      memberIds: participantIds,
      groupId,
    },
  });
} else {
  if (groupId) {
  const tabs = navigation.getParent();

  tabs?.navigate('Messages');

  tabs?.dispatch(
    CommonActions.navigate({
      name: 'Messages',
      params: {
        screen: 'Conversation',
        params: {
          kind: 'group',
          title: eventName,
          memberIds: participantIds,
          groupId,
        },
      },
    })
  );
} else {
  Alert.alert('Event Created', 'Your event was saved!');
  navigation.getParent()?.navigate('Home');
}
  navigation.getParent()?.navigate('Home');
}

} catch (error) {
    console.error('Failed to create event:', error);
    Alert.alert('Error', 'Unable to save event. Please try again.');
  } finally {
    setSavingEvent(false);
  }
};

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradients.background}
        start={gradientDirection.vertical.start}
        end={gradientDirection.vertical.end}
        style={StyleSheet.absoluteFill}
      />

      <ScreenHeader
        title="Review Event"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* EVENT PHOTO - MATCHES EDIT PROFILE */}

        {/* EVENT PHOTO */}
        <View style={styles.photoContainer}>
          <EditPhoto
            photoUri={eventPhoto}
            onPress={openPhotoOptions}
            size={120}
            disabled={photoLoading}
          />
        </View>

        <Text style={styles.eventTitle}>
          {eventName || 'Untitled Event'}
        </Text>

        <View style={styles.eventInfo}>
  <View style={styles.eventInfoLeft}>
    {/* CATEGORY */}
    <Pressable
      onPress={() =>
        navigation.navigate('EventDetails', {
          ...route.params,
          eventPhoto,
          editingFromReview: true,
        })
      }
    >
      <Text style={styles.eventInfoText}>
        {category || 'No Category'}
      </Text>
    </Pressable>

    {/* DATE */}
    <Pressable
      onPress={() =>
        navigation.navigate('PickTime', {
          ...route.params,
          eventPhoto,
          editingFromReview: true,
        })
      }
    >
      <Text style={styles.eventInfoText}>
        {formatEventDate(eventTimes)}
      </Text>
    </Pressable>
  </View>

  <View style={styles.infoDivider} />

  <View style={styles.eventInfoRight}>
    {/* LOCATION */}
    <Pressable
      style={styles.infoRow}
      onPress={() =>
        navigation.navigate('PickLocation', {
          ...route.params,
          eventPhoto,
          editingFromReview: true,
        })
      }
    >
      <Ionicons
        name="location-outline"
        size={19}
        color={colors.white}
      />
      <Text style={styles.eventInfoText}>
        {location || 'Location not selected'}
      </Text>
    </Pressable>

    {/* TIME */}
    <Pressable
      style={styles.infoRow}
      onPress={() =>
        navigation.navigate('PickTime', {
          ...route.params,
          eventPhoto,
          editingFromReview: true,
        })
      }
    >
      <Ionicons
        name="time-outline"
        size={19}
        color={colors.white}
      />
      <Text style={styles.eventInfoText}>
        {formatEventTime(eventTimes)}
      </Text>
    </Pressable>
  </View>
</View>

        <View style={styles.descriptionBox}>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Event Description..."
            placeholderTextColor={colors.white}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* REMINDER DROPDOWN */}

        <View style={styles.reminderContainer}>
          <Pressable
            style={styles.reminderButton}
            onPress={() => setReminderOpen(!reminderOpen)}
          >
            <Text style={styles.reminderText}>
              Reminder: {reminder}
            </Text>
            <Ionicons
              name={reminderOpen ? 'chevron-up' : 'chevron-down'}
              size={26}
              color={colors.white}
            />
          </Pressable>

          {reminderOpen && (
            <View style={styles.reminderOptions}>
              {[
                '30 minutes before',
                '1 hour before',
                '2 hours before',
                '24 hours before',
              ].map((option) => (
                <Pressable
                  key={option}
                  style={styles.reminderOption}
                  onPress={() => {
                    setReminder(option);
                    setReminderOpen(false);
                  }}
                >
                  <Text style={styles.reminderText}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ITEMS */}

        <SectionHeading title="Items" />

        {items.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.planningRow,
              isPressed('item', item.id) &&
                styles.planningRowPressed,
            ]}
            onPressIn={() =>
              setPressedEntry({ type: 'item', id: item.id })
            }
            onPressOut={() => setPressedEntry(null)}
            onLongPress={() =>
              setDeleteEntry({ type: 'item', id: item.id })
            }
            delayLongPress={450}
          >
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
              <Text
                style={styles.planningPrice}
                numberOfLines={1}
              >
                {formatPrice(item.price)}
              </Text>

              <Pressable
                onPress={() => toggleItem(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: item.completed,
                }}
              >
                <Ionicons
                  name={
                    item.completed
                      ? 'checkbox-outline'
                      : 'square-outline'
                  }
                  size={27}
                  color={colors.white}
                />
              </Pressable>
            </View>
          </Pressable>
        ))}

        <Pressable
          style={styles.addButton}
          onPress={() => openAddModal('item')}
        >
          <Ionicons
            name="add"
            size={32}
            color={colors.white}
          />
        </Pressable>

        <Text style={styles.totalText}>
          Total: {formatPrice(total)}
        </Text>

        {/* TASKS */}

        <SectionHeading title="Tasks" />

        {tasks.map((task) => (
          <Pressable
            key={task.id}
            style={[
              styles.planningRow,
              isPressed('task', task.id) &&
                styles.planningRowPressed,
            ]}
            onPressIn={() =>
              setPressedEntry({ type: 'task', id: task.id })
            }
            onPressOut={() => setPressedEntry(null)}
            onLongPress={() =>
              setDeleteEntry({ type: 'task', id: task.id })
            }
            delayLongPress={450}
          >
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
                onPress={() => toggleTask(task.id)}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: task.completed,
                }}
              >
                <Ionicons
                  name={
                    task.completed
                      ? 'checkbox-outline'
                      : 'square-outline'
                  }
                  size={27}
                  color={colors.white}
                />
              </Pressable>
            </View>
          </Pressable>
        ))}

        <Pressable
          style={styles.addButton}
          onPress={() => openAddModal('task')}
        >
          <Ionicons
            name="add"
            size={32}
            color={colors.white}
          />
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => navigation.getParent()?.navigate('Home')}
        >
          <Ionicons
            name="trash-outline"
            size={25}
            color={colors.red}
          />
          <Text style={styles.deleteText}>
            Delete Event
          </Text>
        </Pressable>
      </ScrollView>

      {/* CONFIRM EVENT */}

      <View style={styles.confirmContainer}>
        <Pressable
          onPress={() => void handleConfirmEvent()}
          disabled={savingEvent}
          style={styles.confirmButton}
        >
          <LinearGradient
            colors={gradients.purpleAccent}
            start={gradientDirection.horizontal.start}
            end={gradientDirection.horizontal.end}
            style={styles.confirmGradient}
          >
            <Text style={styles.confirmText}>
              Confirm Event
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ADD ITEM / TASK MODAL */}

      <Modal
        visible={modalType !== null}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios' ? 'padding' : undefined
          }
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Add {modalType === 'item' ? 'Item' : 'Task'}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={
                modalType === 'item'
                  ? 'Item name'
                  : 'Task name'
              }
              placeholderTextColor={colors.white}
              autoFocus
            />

            {modalType === 'item' && (
              <TextInput
                style={styles.modalInput}
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="Price ($)"
                placeholderTextColor={colors.white}
                keyboardType="decimal-pad"
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeAddModal}
              >
                <Text style={styles.modalActionText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.saveButton}
                onPress={handleAdd}
              >
                <Text style={styles.modalActionText}>
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ASSIGNMENT MODAL */}

      <Modal
        visible={assignmentEntry !== null}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAssignmentEntry(null)
        }
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAssignmentEntry(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <Text style={styles.modalTitle}>
              {assignmentTarget?.name}
            </Text>

            <View style={styles.assignmentProfile}>
              <View style={styles.assignmentAvatar}>
                {assignmentTarget?.assigneeId ===
                  user?.uid && myPhoto ? (
                  <Image
                    source={{ uri: myPhoto }}
                    style={styles.assignmentPhoto}
                  />
                ) : (
                  <Ionicons
                    name="person-outline"
                    size={32}
                    color={colors.white}
                  />
                )}
              </View>

              <Text style={styles.assignmentLabel}>
                Assigned to
              </Text>

              <Text style={styles.assignmentName}>
                {getAssigneeName(
                  assignmentTarget?.assigneeId ?? null
                )}
              </Text>
            </View>

            {assignmentTarget?.assigneeId === user?.uid ? (
              <Pressable
                style={styles.assignmentOption}
                onPress={() =>
                  updateAssignment(false)
                }
              >
                <Ionicons
                  name="person-remove-outline"
                  size={22}
                  color={colors.white}
                />
                <Text style={styles.modalActionText}>
                  Unassign myself
                </Text>
              </Pressable>
            ) : !assignmentTarget?.assigneeId ? (
              <Pressable
                style={styles.assignmentOption}
                onPress={() =>
                  updateAssignment(true)
                }
                disabled={!user}
              >
                <Ionicons
                  name="person-add-outline"
                  size={22}
                  color={colors.white}
                />
                <Text style={styles.modalActionText}>
                  Assign to myself
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.assignmentLabel}>
                This is assigned to another member.
              </Text>
            )}

            <Pressable
              style={styles.assignmentCancelButton}
              onPress={() =>
                setAssignmentEntry(null)
              }
            >
              <Text style={styles.modalActionText}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* LONG-PRESS DELETE MODAL */}

      <Modal
        visible={deleteEntry !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteEntry(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDeleteEntry(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <Text style={styles.modalTitle}>
              {deleteTarget?.name}
            </Text>

            <Pressable
              style={styles.deleteOption}
              onPress={openDeleteConfirmation}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={colors.red}
              />
              <Text style={styles.deleteOptionText}>
                Delete {deleteEntry?.type}
              </Text>
            </Pressable>

            <Pressable
              style={styles.assignmentCancelButton}
              onPress={() => setDeleteEntry(null)}
            >
              <Text style={styles.modalActionText}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );}

function SectionHeading({
  title,
}: {
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionHeadingText}>
        {title}
      </Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
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

  // EVENT PHOTO

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

  // Same badge dimensions and positioning as Edit Profile.
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

  descriptionInput: {
    minHeight: 140,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    textAlignVertical: 'top',
  },

  // REMINDER

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

  reminderOptions: {
    marginTop: 5,
    borderRadius: 16,
    backgroundColor: colors.cardLighter,
    overflow: 'hidden',
  },

  reminderOption: {
    paddingHorizontal: 13,
    paddingVertical: 12,
  },

  // ITEMS AND TASKS

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
    transform: [{ scale: 1 }],
  },

  planningRowPressed: {
    transform: [{ scale: 1.025 }],
    elevation: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 2,
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

  assigneePhoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
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

  // CONFIRM BUTTON

  confirmContainer: {
    paddingHorizontal: 1,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.bgEnd,
  },

  confirmButton: {
    height: 72,
    borderRadius: 25,
    overflow: 'hidden',
  },

  confirmGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 17,
  },

  // MODALS

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  modalCard: {
    backgroundColor: colors.cardDarker,
    borderRadius: 22,
    padding: 22,
    gap: 16,
  },

  modalTitle: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 21,
    textAlign: 'center',
  },

  modalInput: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.cardLighter,
    paddingHorizontal: 15,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.cardLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalActionText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },

  assignmentProfile: {
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
  },

  assignmentAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },

  assignmentPhoto: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },

  assignmentLabel: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    opacity: 0.75,
    textAlign: 'center',
  },

  assignmentName: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    textAlign: 'center',
  },

  assignmentOption: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  assignmentCancelButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.cardLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteOption: {
    backgroundColor: colors.cardLighter,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  deleteOptionText: {
    color: colors.red,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
});
