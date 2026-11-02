
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';

type EditPhotoProps = {
  photoUri?: string | null;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
};

export function EditPhoto({
  photoUri,
  onPress,
  size = 120,
  disabled = false,
}: EditPhotoProps) {
  const badgeSize = Math.max(30, size * 0.28);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        photoUri ? 'Change photo' : 'Add photo'
      }
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <View
        style={[
          styles.photoCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name="image-outline"
            size={size * 0.38}
            color={colors.white}
          />
        )}
      </View>

      <View
        style={[
          styles.cameraBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            right: 0,
            bottom: 0,
          },
        ]}
      >
        <Ionicons
          name="camera"
          size={badgeSize * 0.58}
          color={colors.white}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoCircle: {
    backgroundColor: colors.cardLighter,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photo: {
    width: '100%',
    height: '100%',
  },

  cameraBadge: {
    position: 'absolute',
    backgroundColor: colors.primaryAccent,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
