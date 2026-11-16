
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  colors,
  fontFamily,
  gradients,
  gradientDirection,
} from '@/theme';

type ContinueButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export function ContinueButton({
  title,
  onPress,
  disabled = false,
}: ContinueButtonProps) {
  return (
    <LinearGradient
      colors={gradients.purpleAccent}
      {...gradientDirection.horizontal}
      style={styles.gradient}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={styles.label}>{title}</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },

  button: {
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.5,
  },
});
