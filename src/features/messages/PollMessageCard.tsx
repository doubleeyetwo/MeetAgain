import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '@/theme';
import type { GroupPollMessage } from '@/features/messages/messages';
import { isPollOpen, pollTimeLabel, tallyPoll } from '@/features/messages/polls';
import { PollResultsChart } from '@/features/messages/PollResultsChart';
import { useNow } from '@/features/messages/useNow';
import { usePoll } from '@/features/messages/usePoll';

// Shows a posted poll in the chat with a live results diagram and the time left to vote;
// tapping it opens voting, or the final results once the poll has ended.
export function PollMessageCard({ poll, groupId, voterId, onPress }: {
  poll: GroupPollMessage;
  groupId: string;
  voterId?: string;
  onPress: () => void;
}) {
  const { poll: pollDoc, loading } = usePoll(groupId, poll.id);
  const now = useNow();
  const ended = !!pollDoc && !isPollOpen(pollDoc, now);
  // Ended polls say so in the footer, so the countdown only shows while voting is open.
  const timeLabel = pollDoc && !ended ? pollTimeLabel(pollDoc, now) : null;
  const tally = tallyPoll(poll.options, pollDoc?.votes ?? {});
  const hasVoted = !!voterId && pollDoc?.votes[voterId] !== undefined;
  const voteLabel = `${tally.total} ${tally.total === 1 ? 'vote' : 'votes'}`;

  let footer = `${voteLabel} · Tap to vote`;
  if (loading) footer = 'Loading votes...';
  else if (ended) footer = `Poll ended · ${voteLabel}`;
  else if (hasVoted) footer = `You voted · ${voteLabel}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open poll: ${poll.question}`}
      accessibilityHint={footer}
      onPress={onPress}
      style={styles.card}
    >
      <Text style={styles.title}>{ended ? 'Poll Results' : 'Time to Vote'}</Text>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.chart}>
        <PollResultsChart options={poll.options} counts={tally.counts} compact />
      </View>
      {timeLabel !== null ? <Text style={styles.timeLeft}>{timeLabel}</Text> : null}
      <Text style={styles.footer}>{footer}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 240, padding: spacing.md, gap: spacing.sm, borderRadius: 12, backgroundColor: colors.cardDarker },
  title: { ...text.header, color: colors.white, textAlign: 'center' },
  question: { ...text.body, color: colors.white, textAlign: 'center' },
  chart: { paddingHorizontal: spacing.sm },
  timeLeft: { ...text.body, color: colors.white, textAlign: 'center' },
  footer: { ...text.body, color: 'rgba(244,241,247,0.8)', textAlign: 'center' },
});
