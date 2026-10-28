import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import {
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_QUESTION_LENGTH,
  MIN_POLL_OPTIONS,
  normalizePollDraft,
} from '@/features/messages/polls';

type AnswerField = { key: number; text: string };

function blankAnswers(): AnswerField[] {
  return Array.from({ length: MIN_POLL_OPTIONS }, (_, index) => ({ key: index, text: '' }));
}

export function PollCreationModal({ visible, onClose, onPost }: {
  visible: boolean;
  onClose: () => void;
  // Receives the trimmed question and non-blank answers; reject to keep the pop-up open.
  onPost: (question: string, options: string[]) => Promise<void>;
}) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<AnswerField[]>(blankAnswers);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  // Stable keys keep each TextInput attached to its answer when another row is removed.
  const nextKey = useRef(MIN_POLL_OPTIONS);
  // A ref blocks a second tap before the posting state re-renders the button.
  const postingRef = useRef(false);

  const draft = normalizePollDraft(question, answers.map((answer) => answer.text));
  const canPost = draft.problem === null && !posting;
  // Only explain problems the disabled button doesn't already make obvious, such as duplicate answers.
  const requiredFilled = draft.question.length > 0 && draft.options.length >= MIN_POLL_OPTIONS;

  function reset() {
    setQuestion('');
    setAnswers(blankAnswers());
    setPostError(null);
    nextKey.current = MIN_POLL_OPTIONS;
  }

  function handleClose() {
    // A write already in flight can't be recalled, so keep the pop-up until it settles.
    if (postingRef.current) return;
    reset();
    onClose();
  }

  function updateAnswer(key: number, value: string) {
    setAnswers((current) => current.map((answer) => (answer.key === key ? { ...answer, text: value } : answer)));
  }

  function addAnswer() {
    if (answers.length >= MAX_POLL_OPTIONS) return;
    const key = nextKey.current++;
    setAnswers((current) => [...current, { key, text: '' }]);
  }

  function removeAnswer(key: number) {
    if (answers.length <= MIN_POLL_OPTIONS) return;
    setAnswers((current) => current.filter((answer) => answer.key !== key));
  }

  async function handlePost() {
    if (postingRef.current || draft.problem) return;
    postingRef.current = true;
    setPosting(true);
    setPostError(null);

    try {
      await onPost(draft.question, draft.options);
      reset();
      onClose();
    }
    catch (error) {
      // Keep the entered text so the user can retry.
      setPostError(error instanceof Error ? error.message : 'Could not post your poll.');
    }
    finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleSide} />
            <Text style={styles.title}>Poll Creation</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel poll"
              hitSlop={12}
              disabled={posting}
              onPress={handleClose}
              style={styles.titleSide}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Question</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="What would you like to poll?"
              placeholderTextColor="rgba(244,241,247,0.65)"
              accessibilityLabel="Poll question"
              maxLength={MAX_POLL_QUESTION_LENGTH}
              editable={!posting}
            />

            <Text style={styles.sectionTitle}>Answers</Text>
            <View style={styles.divider} />
            {answers.map((answer, index) => {
              const canRemove = !posting && answers.length > MIN_POLL_OPTIONS;
              return (
                <View key={answer.key} style={styles.answerRow}>
                  <TextInput
                    style={[styles.input, styles.answerInput]}
                    value={answer.text}
                    onChangeText={(value) => updateAnswer(answer.key, value)}
                    placeholder="Type your answer..."
                    placeholderTextColor="rgba(244,241,247,0.65)"
                    accessibilityLabel={`Answer ${index + 1}`}
                    maxLength={MAX_POLL_OPTION_LENGTH}
                    editable={!posting}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove answer ${index + 1}`}
                    hitSlop={8}
                    disabled={!canRemove}
                    onPress={() => removeAnswer(answer.key)}
                    style={[styles.removeButton, !canRemove && styles.disabled]}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.red} />
                  </Pressable>
                </View>
              );
            })}
            {answers.length < MAX_POLL_OPTIONS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add answer"
                disabled={posting}
                onPress={addAnswer}
                style={styles.addButton}
              >
                <Ionicons name="add" size={28} color={colors.white} />
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={styles.divider} />
          {postError !== null ? (
            <Text accessibilityRole="alert" style={styles.error}>{postError}</Text>
          ) : requiredFilled && draft.problem !== null ? (
            <Text style={styles.error}>{draft.problem}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post poll"
            accessibilityState={{ disabled: !canPost }}
            disabled={!canPost}
            onPress={handlePost}
            style={!canPost && styles.disabled}
          >
            <LinearGradient colors={gradients.purpleAccent} {...gradientDirection.horizontal} style={styles.postButton}>
              {posting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.postText}>Post</Text>}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  sectionTitle: { ...text.header, color: colors.white, textAlign: 'center' },
  divider: { height: 2, backgroundColor: colors.primaryAccent, marginBottom: spacing.xs },
  input: {
    ...text.body,
    color: colors.white,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.cardLighter,
  },
  answerRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: colors.cardLighter },
  answerInput: { flex: 1 },
  removeButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  addButton: { alignSelf: 'center', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { ...text.body, color: '#FFB4AB', textAlign: 'center' },
  postButton: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  postText: { ...text.body, fontSize: 16, color: colors.white },
  disabled: { opacity: 0.4 },
});
