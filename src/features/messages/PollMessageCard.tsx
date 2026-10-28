import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '@/theme';
import type { GroupPollMessage } from '@/features/messages/messages';

// Shows a posted poll in the chat timeline. Voting on the choices is not supported yet.
export function PollMessageCard({ poll }: { poll: GroupPollMessage }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Time to Vote</Text>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.divider} />
      <Text style={styles.choicesLabel}>Choices</Text>
      {poll.options.map((option, index) => (
        <View key={index} style={styles.option}>
          <Text style={styles.optionText}>{option}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 240, padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.cardDarker },
  title: { ...text.header, color: colors.white, textAlign: 'center' },
  question: { ...text.body, color: colors.white, textAlign: 'center' },
  divider: { height: 2, backgroundColor: colors.primaryAccent },
  choicesLabel: { ...text.body, color: 'rgba(244,241,247,0.8)', textAlign: 'center' },
  option: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: 8, backgroundColor: colors.cardLighter },
  optionText: { ...text.body, color: colors.white, textAlign: 'center' },
});
