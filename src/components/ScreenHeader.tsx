import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, text } from '@/theme';

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
};

export function ScreenHeader({
  title,
  onBack,
}: ScreenHeaderProps) {
  return (
    <SafeAreaView
      edges={['top']}
      style={styles.safeArea}
    >
      <View style={styles.container}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.side}
            hitSlop={12}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.white}
            />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}

        <Text style={styles.title}>{title}</Text>

        <View style={styles.side} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
  },

  container: {
    height: 71,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  side: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    flex: 1,
    ...text.title,
    color: colors.white,
    textAlign: 'center',
  },
});