import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '@/theme';

// The Figma results use blue, purple, and pink bars; extra answers continue with theme accents.
const BAR_COLORS = [
  colors.fieldLabel,
  colors.primaryAccent,
  '#ffd6e5',
  colors.linkAccent,
  colors.purpleAccentGradientStart,
  colors.white,
];

const MIN_BAR_HEIGHT = 6;

export function PollResultsChart({ options, counts, compact = false }: {
  options: string[];
  counts: number[];
  // The chat widget shows bars only; the results view adds counts and answer labels.
  compact?: boolean;
}) {
  const maxHeight = compact ? 56 : 110;
  const top = Math.max(1, ...counts);
  const summary = options.map((option, index) => `${option}: ${counts[index] ?? 0}`).join(', ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Votes. ${summary}`} style={styles.chart}>
      {options.map((option, index) => {
        const count = counts[index] ?? 0;
        const height = Math.max(MIN_BAR_HEIGHT, Math.round((count / top) * maxHeight));
        return (
          <View key={index} style={styles.column}>
            {compact ? null : <Text style={styles.count}>{count}</Text>}
            <View
              style={[
                styles.bar,
                compact ? styles.compactBar : styles.fullBar,
                { height, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] },
              ]}
            />
            {compact ? null : <Text numberOfLines={2} style={styles.label}>{option}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.sm },
  column: { flex: 1, maxWidth: 72, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  bar: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  compactBar: { width: 22 },
  fullBar: { width: '100%', maxWidth: 56 },
  count: { ...text.body, color: colors.white },
  label: { ...text.body, fontSize: 12, color: colors.white, textAlign: 'center' },
});
