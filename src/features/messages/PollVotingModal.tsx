import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import type { GroupPollMessage } from '@/features/messages/messages';
import { castPollVote, tallyPoll } from '@/features/messages/polls';
import { PollResultsChart } from '@/features/messages/PollResultsChart';
import { usePoll } from '@/features/messages/usePoll';

// Opens on "Time to Vote" and switches to the live results after a vote is saved.
export function PollVotingModal({ groupId, poll, voterId, onClose }: {
  groupId: string;
  poll: GroupPollMessage;
  voterId: string;
  onClose: () => void;
}) {
  const { poll: pollDoc, loading, error: loadError } = usePoll(groupId, poll.id);
  const [view, setView] = useState<'vote' | 'results'>('vote');
  const [selected, setSelected] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  // A ref blocks a second tap before the voting state re-renders the button.
  const votingRef = useRef(false);

  const currentVote = pollDoc?.votes[voterId];
  // Start from the member's saved vote so voting again replaces it.
  const choice = selected ?? currentVote ?? null;
  const canVote = !!pollDoc && choice !== null && !voting;
  const tally = tallyPoll(poll.options, pollDoc?.votes ?? {});

  let status: string | null = null;
  if (loading) status = 'Loading poll...';
  else if (loadError !== null) status = loadError;
  else if (currentVote !== undefined) status = `You voted for ${poll.options[currentVote] ?? 'an answer'}. Pick again to change your vote.`;

  async function handleVote() {
    if (votingRef.current || !pollDoc || choice === null) return;
    votingRef.current = true;
    setVoting(true);
    setVoteError(null);

    try {
      await castPollVote(groupId, poll.id, voterId, choice);
      setSelected(null);
      setView('results');
    }
    catch (error) {
      // Stay on the voting view so the member can retry the same choice.
      setVoteError(error instanceof Error ? error.message : 'Could not save your vote.');
    }
    finally {
      votingRef.current = false;
      setVoting(false);
    }
  }

  function handleClose() {
    // A vote in flight still lands, so wait for it rather than leaving a stale pop-up state.
    if (votingRef.current) return;
    onClose();
  }

  let winner = 'No votes yet';
  if (tally.winners.length === 1) winner = poll.options[tally.winners[0]];
  else if (tally.winners.length > 1) winner = `Tie: ${tally.winners.map((index) => poll.options[index]).join(', ')}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleSide} />
            <Text style={styles.title}>{view === 'vote' ? 'Time to Vote' : 'Poll Results'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close poll"
              hitSlop={12}
              disabled={voting}
              onPress={handleClose}
              style={styles.titleSide}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.divider} />

          {view === 'vote' ? (
            <>
              <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <View style={styles.questionBox}>
                  <Text style={styles.questionText}>{poll.question}</Text>
                </View>
                <Text style={styles.sectionTitle}>Choices</Text>
                <View style={styles.divider} />
                {poll.options.map((option, index) => {
                  const isSelected = choice === index;
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="radio"
                      accessibilityLabel={option}
                      accessibilityState={{ selected: isSelected, disabled: !pollDoc || voting }}
                      disabled={!pollDoc || voting}
                      onPress={() => setSelected(index)}
                      style={[styles.option, isSelected && styles.optionSelected]}
                    >
                      <Text style={styles.optionText}>{option}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.divider} />
              {voteError !== null ? (
                <Text accessibilityRole="alert" style={styles.error}>{voteError}</Text>
              ) : status !== null ? (
                <Text style={styles.status}>{status}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Vote"
                accessibilityState={{ disabled: !canVote }}
                disabled={!canVote}
                onPress={handleVote}
                style={!canVote && styles.disabled}
              >
                <LinearGradient colors={gradients.purpleAccent} {...gradientDirection.horizontal} style={styles.voteButton}>
                  {voting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.voteText}>Vote</Text>}
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{poll.question}</Text>
              <PollResultsChart options={poll.options} counts={tally.counts} />
              <Text style={styles.status}>
                {tally.total} {tally.total === 1 ? 'vote' : 'votes'} total
              </Text>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Current Winner</Text>
              <Text style={styles.winner}>{winner}</Text>
              {tally.winners.length > 0 ? (
                <Text style={styles.status}>{tally.percentages[tally.winners[0]]}% of votes</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change vote"
                hitSlop={8}
                onPress={() => setView('vote')}
                style={styles.changeVote}
              >
                <Text style={styles.changeVoteText}>Change vote</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { maxHeight: '90%', backgroundColor: colors.cardDarker, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleSide: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.title, flex: 1, color: colors.white, textAlign: 'center' },
  scroll: { flexGrow: 0 },
  content: { gap: spacing.sm },
  divider: { height: 2, backgroundColor: colors.primaryAccent, marginBottom: spacing.xs },
  questionBox: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 8, backgroundColor: colors.cardLighter },
  questionText: { ...text.body, color: colors.white },
  sectionTitle: { ...text.header, color: colors.white, textAlign: 'center' },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 8, backgroundColor: colors.cardLighter },
  optionSelected: { backgroundColor: colors.primaryAccent },
  optionText: { ...text.body, color: colors.white, textAlign: 'center' },
  status: { ...text.body, color: 'rgba(244,241,247,0.8)', textAlign: 'center' },
  error: { ...text.body, color: '#FFB4AB', textAlign: 'center' },
  voteButton: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  voteText: { ...text.body, fontSize: 16, color: colors.white },
  disabled: { opacity: 0.4 },
  winner: { ...text.title, color: colors.white, textAlign: 'center' },
  changeVote: { alignSelf: 'center', paddingVertical: spacing.xs },
  changeVoteText: { ...text.body, color: colors.linkAccent },
});
