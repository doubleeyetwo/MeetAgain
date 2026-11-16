
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

import {
  EVENT_TEMPLATES,
  buildTemplateParams,
  type EventTemplate,
} from '@/features/events/eventTemplates';
import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'EventTemplates'
>;

export function EventTemplatesScreen({ navigation }: Props) {
  const openCustomEvent = () => {
    navigation.navigate('EventDetails');
  };

  const openPresetEvent = (template: EventTemplate) => {
    // Fresh params every time, so switching templates never carries over
    // anything from a previous choice.
    navigation.navigate('EventDetails', buildTemplateParams(template));
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
            onPress={() => openPresetEvent(template)}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={template.icon as keyof typeof Ionicons.glyphMap}
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
          onPress={openCustomEvent}
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
