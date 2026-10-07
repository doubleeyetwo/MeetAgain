import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontFamily, radius, text } from '@/theme';

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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 57,
    borderRadius: radius.md,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    ...text.body,
    fontFamily: 'Moderustic_600SemiBold',
    color: colors.white,
    fontSize: 16,
  },

  pressed: {
    opacity: 0.85,
  },

  disabled: {
    opacity: 0.5,
  },
});