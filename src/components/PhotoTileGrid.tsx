import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, spacing, text } from '@/theme';

// If you want to modify, keep the ratio and let each row divide the width.
const TILE_ASPECT = 104 / 93;
const TILE_RADIUS = 10;
const GRID_GAP = 10;
const COLUMNS = 3;

export type PhotoTile = {
  id: string;
  // Read by screen readers, and shown on the tile when it has no photo.
  label: string;
  photoUri?: string | null;
};

type PhotoTileGridProps = {
  tiles: PhotoTile[];
  onPressTile: (id: string) => void;
  selectedId?: string | null;
  style?: StyleProp<ViewStyle>;
};

// Three-column photo tiles used by profile past events and event memories.
export function PhotoTileGrid({ tiles, onPressTile, selectedId, style }: PhotoTileGridProps) {
  // Pad the final row so three tiles per row keep their width.
  const rows: (PhotoTile | null)[][] = [];
  for (let index = 0; index < tiles.length; index += COLUMNS) {
    const row: (PhotoTile | null)[] = tiles.slice(index, index + COLUMNS);
    while (row.length < COLUMNS) row.push(null);
    rows.push(row);
  }

  return (
    <View style={[styles.grid, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((tile, cellIndex) => {
            if (!tile) return <View key={`empty-${cellIndex}`} style={styles.spacer} />;
            const selected = tile.id === selectedId;
            return (
              <Pressable
                key={tile.id}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                accessibilityState={{ selected }}
                onPress={() => onPressTile(tile.id)}
                style={({ pressed }) => [styles.tile, selected && styles.selected, pressed && styles.pressed]}
              >
                {tile.photoUri ? (
                  <Image source={{ uri: tile.photoUri }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.fallback}>
                    <Text style={styles.fallbackText} numberOfLines={3}>{tile.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// The centered icon and message shown where a grid has nothing to show yet.
export function TileGridMessage({ message }: { message: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name="images-outline" size={32} color={colors.white} />
      <Text style={styles.messageText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: GRID_GAP,
  },
  row: { flexDirection: 'row', gap: GRID_GAP },
  tile: {
    flex: 1,
    aspectRatio: TILE_ASPECT,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.cardDarker,
  },
  selected: { borderWidth: 2, borderColor: colors.purpleAccentGradientStart },
  pressed: { opacity: 0.85 },
  image: { width: '100%', height: '100%' },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  fallbackText: {
    ...text.body,
    color: colors.white,
    fontSize: 13,
    textAlign: 'center',
  },
  spacer: { flex: 1 },
  message: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  messageText: { ...text.body, color: colors.white, opacity: 0.6, textAlign: 'center' },
});
