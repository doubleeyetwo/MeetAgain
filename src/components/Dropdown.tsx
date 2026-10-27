import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fontFamily, radius, spacing } from '@/theme';

export type DropdownOption<T> = {
  label: string;
  value: T;
};

type DropdownProps<T> = {
  // Read by screen readers, e.g. "Start date".
  accessibilityLabel: string;
  // Shown on the closed field. It can differ from every option label, e.g. a time set elsewhere.
  displayText: string;
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  invalid?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Anchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const OPTION_HEIGHT = 40;
const MAX_VISIBLE_OPTIONS = 6;
const MENU_GAP = 4;
const MIN_MENU_WIDTH = 120;

// A field that opens a scrollable list under itself, or above it near the bottom of the screen.
// The list renders in a Modal so a parent card or ScrollView can't clip it.
export function Dropdown<T extends string | number>({
  accessibilityLabel,
  displayText,
  options,
  value,
  onChange,
  invalid = false,
  style,
}: DropdownProps<T>) {
  const fieldRef = useRef<PressableInstance>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const { width: windowWidth, height: windowHeight } =
    useWindowDimensions();

  // Measured on every open so the list lines up after the page scrolls.
  const open = () => {
    fieldRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height })
    );
  };

  const close = () => setAnchor(null);

  const select = (next: T) => {
    onChange(next);
    close();
  };

  const menuHeight =
    Math.min(options.length, MAX_VISIBLE_OPTIONS) * OPTION_HEIGHT;

  // Opens with the selected option near the top, without scrolling past the end.
  const selectedIndex = options.findIndex(
    (option) => option.value === value
  );
  const initialScrollIndex = Math.min(
    Math.max(selectedIndex - 2, 0),
    Math.max(options.length - MAX_VISIBLE_OPTIONS, 0)
  );

  let menuPosition: ViewStyle | null = null;

  if (anchor) {
    const width = Math.max(anchor.width, MIN_MENU_WIDTH);
    const below = anchor.y + anchor.height + MENU_GAP;
    const fitsBelow =
      below + menuHeight <= windowHeight - spacing.md;

    menuPosition = {
      top: fitsBelow
        ? below
        : Math.max(spacing.md, anchor.y - MENU_GAP - menuHeight),
      left: Math.min(anchor.x, windowWidth - width - spacing.md),
      width,
      height: menuHeight,
    };
  }

  return (
    <>
      <Pressable
        ref={fieldRef}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, ${displayText}`}
        style={({ pressed }) => [
          styles.field,
          invalid && styles.invalidField,
          pressed && styles.pressed,
          style,
        ]}
      >
        <Text
          style={styles.fieldText}
          numberOfLines={1}
        >
          {displayText}
        </Text>

        <Ionicons
          name={anchor ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.white}
        />
      </Pressable>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="Close list"
        />

        {menuPosition && (
          <View style={[styles.menu, menuPosition]}>
            <FlatList
              data={options}
              keyExtractor={(option) => String(option.value)}
              getItemLayout={(_, index) => ({
                length: OPTION_HEIGHT,
                offset: OPTION_HEIGHT * index,
                index,
              })}
              initialScrollIndex={initialScrollIndex}
              renderItem={({ item }) => {
                const selected = item.value === value;

                return (
                  <Pressable
                    onPress={() => select(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.selectedOption,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.optionText}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.cardLighter,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },

  invalidField: {
    borderColor: colors.red,
  },

  fieldText: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },

  menu: {
    position: 'absolute',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryAccent,
    backgroundColor: colors.cardLighter,
    overflow: 'hidden',
  },

  option: {
    height: OPTION_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  selectedOption: {
    backgroundColor: colors.primaryAccent,
  },

  optionText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 14,
  },

  pressed: {
    opacity: 0.85,
  },
});
