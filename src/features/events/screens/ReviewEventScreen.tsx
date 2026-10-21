
import { useState } from 'react';
import {
  Alert,
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

import { ScreenHeader } from '@/components/ScreenHeader';
import {colors,
  fontFamily,
  gradients,
  gradientDirection,
} from '@/theme';

import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';
import {
  formatEventDate,
  formatEventTime,
} from '@/features/events/eventTimes';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'ReviewEvent'
>;

type EventItem = {
  id: number;
  name: string;
  price: number;
  completed: boolean;
};

type EventTask = {
  id: number;
  name: string;
  completed: boolean;
};

type AddType = 'item' | 'task';

export function ReviewEventScreen({
  navigation,
  route,
}: Props) {
  const { eventName, category, startAt, endAt } = route.params;
  const eventTimes = {
    start: new Date(startAt),
    end: new Date(endAt),
  };

  const [description, setDescription] = useState('');
  const [reminder, setReminder] = useState('24 hours before');
  const [reminderOpen, setReminderOpen] = useState(false);

  const [items, setItems] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);

  const [modalType, setModalType] = useState<AddType | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const total = items.reduce(
    (sum, item) => sum + item.price,
    0
  );

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

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
        `Please enter a ${modalType === 'item' ? 'name for the item' : 'task name'}.`
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
        },
      ]);
    } else if (modalType === 'task') {
      setTasks((current) => [
        ...current,
        {
          id: Date.now(),
          name: trimmedName,
          completed: false,
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

  const removeItem = (id: number) => {
    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  };

  const removeTask = (id: number) => {
    setTasks((current) =>
      current.filter((task) => task.id !== id)
    );
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
        <View style={styles.photoCircle}>
          <Ionicons
            name="camera-outline"
            size={53}
            color={colors.white}
          />
          <Ionicons
            name="add"
            size={23}
            color={colors.white}
            style={styles.cameraPlus}
          />
        </View>

        <Text style={styles.eventTitle}>
          {eventName || 'Untitled Event'}
        </Text>

        <View style={styles.eventInfo}>
          <View style={styles.eventInfoLeft}>
            <Text style={styles.eventInfoText}>
              {category || 'No Category'}
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
                Location not selected
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

        <SectionHeading title="Items" />

        {items.map((item) => (
          <View
            key={item.id}
            style={styles.planningRow}
          >
            <Text
              style={[
                styles.planningTitle,
                item.completed && styles.completedText,
              ]}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <View style={styles.assigneePlaceholder}>
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.white}
              />
            </View>

            <Text style={styles.planningPrice}>
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

            <Pressable
              onPress={() => removeItem(item.id)}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={18}
                color={colors.white}
              />
            </Pressable>
          </View>
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

        <SectionHeading title="Tasks" />

        {tasks.map((task) => (
          <View
            key={task.id}
            style={styles.planningRow}
          >
            <Text
              style={[
                styles.planningTitle,
                task.completed && styles.completedText,
              ]}
              numberOfLines={2}
            >
              {task.name}
            </Text>

            <View style={styles.assigneePlaceholder}>
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.white}
              />
            </View>

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

            <Pressable
              onPress={() => removeTask(task.id)}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={18}
                color={colors.white}
              />
            </Pressable>
          </View>
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
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="trash-outline"
            size={25}
            color={colors.red}
/>
          /
          <Text style={styles.deleteText}>
            Delete Event
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.confirmContainer}>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Confirm Event',
              'Saving events will be connected later.'
            )
          }
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
    </View>
  );
}

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

  photoCircle: {
    width: 113,
    height: 113,
    borderRadius: 57,
    backgroundColor: colors.cardDarker,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 14,
  },

  cameraPlus: {
    position: 'absolute',
    right: 27,
    top: 23,
    backgroundColor: colors.cardDarker,
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
    gap: 9,
  },

  planningTitle: {
    flex: 1,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 15,
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
  },

  planningPrice: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
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
});
