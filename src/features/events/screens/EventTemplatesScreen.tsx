import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ContinueButton } from '@/components/ContinueButton';
import { colors, fontFamily, spacing } from '@/theme';

import { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'EventTemplates'
>;

const EVENT_TEMPLATES = [
  {
    id: 'campfire',
    name: 'Campfire',
    category: 'Outdoors',
    icon: 'bonfire-outline',
  },
  {
    id: 'study-session',
    name: 'Study Session',
    category: 'Study',
    icon: 'book-outline',
  },
  {
    id: 'dinner',
    name: 'Dinner',
    category: 'Food & Dining',
    icon: 'restaurant-outline',
  },
  {
    id: 'movie-night',
    name: 'Movie Night',
    category: 'Entertainment',
    icon: 'film-outline',
  },
  {
    id: 'beach-day',
    name: 'Beach Day',
    category: 'Outdoors',
    icon: 'sunny-outline',
  },
  {
    id: 'game-night',
    name: 'Game Night',
    category: 'Entertainment',
    icon: 'game-controller-outline',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    category: 'Other',
    icon: 'bag-handle-outline',
  },
] as const;

export function EventTemplatesScreen({ navigation }: Props) {
  const openEventDetails = () => {
    navigation.navigate('EventDetails');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Event Templates" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {EVENT_TEMPLATES.map((template) => (
          <Pressable
            key={template.id}
            style={({ pressed }) => [
              styles.template,
              pressed && styles.pressed,
            ]}
            onPress={openEventDetails}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={template.icon}
                size={30}
                color={colors.white}
              />
            </View>

            <View style={styles.templateText}>
              <Text style={styles.templateName}>
                {template.name}
              </Text>

              <Text style={styles.templateCategory}>
                {template.category}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={24}
              color={colors.white}
            />
          </Pressable>
        ))}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.customButtonContainer}>
        <ContinueButton
          title="Custom Event"
          onPress={openEventDetails}
        />
      </View>
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

  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 14,
  },

  template: {
    height: 105,
    borderRadius: 24,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cardLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },

  templateText: {
    flex: 1,
    marginLeft: spacing.md,
  },

  templateName: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    color: colors.white,
  },

  templateCategory: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.white,
    opacity: 0.65,
  },

  customButtonContainer: {
    paddingHorizontal: 13,
    paddingTop: spacing.sm,
    paddingBottom: 32,
    backgroundColor: colors.bg,
  },

  pressed: {
    opacity: 0.85,
  },

  bottomSpace: {
    height: spacing.sm,
  },
});