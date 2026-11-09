import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// Firestore rules check each option by index, so these limits must match firestore.rules.
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;
export const MAX_POLL_QUESTION_LENGTH = 200;
export const MAX_POLL_OPTION_LENGTH = 80;

export type PollDraft = {
  question: string;
  options: string[];
  // Explains why Post is disabled, or null once the draft can be posted.
  problem: string | null;
};

// Stored at groups/{groupId}/polls/{pollId}; the chat message that shows it has the same ID.
export type GroupPoll = {
  id: string;
  createdBy: string;
  question: string;
  options: string[];
  // Each member's chosen option index, keyed by user ID.
  votes: Record<string, number>;
  createdAt: Timestamp | null;
};

export type PollTally = {
  counts: number[];
  percentages: number[];
  total: number;
  // Indexes of the options with the most votes; empty until someone votes.
  winners: number[];
};

// Trim the draft and drop blank answer fields so the same rules apply to the UI and the write.
export function normalizePollDraft(question: string, options: string[]): PollDraft {
  const trimmedQuestion = question.trim();
  const filledOptions = options.map((option) => option.trim()).filter((option) => option.length > 0);
  const uniqueOptions = new Set(filledOptions.map((option) => option.toLocaleLowerCase()));

  let problem: string | null = null;
  if (trimmedQuestion.length === 0) {
    problem = 'Add a question.';
  } else if (filledOptions.length < MIN_POLL_OPTIONS) {
    problem = `Add at least ${MIN_POLL_OPTIONS} answers.`;
  } else if (filledOptions.length > MAX_POLL_OPTIONS) {
    problem = `Polls can have up to ${MAX_POLL_OPTIONS} answers.`;
  } else if (uniqueOptions.size !== filledOptions.length) {
    problem = 'Each answer must be different.';
  } else if (trimmedQuestion.length > MAX_POLL_QUESTION_LENGTH) {
    problem = `Questions must be ${MAX_POLL_QUESTION_LENGTH} characters or fewer.`;
  } else if (filledOptions.some((option) => option.length > MAX_POLL_OPTION_LENGTH)) {
    problem = `Answers must be ${MAX_POLL_OPTION_LENGTH} characters or fewer.`;
  }

  return { question: trimmedQuestion, options: filledOptions, problem };
}

export async function sendGroupPoll(
  groupId: string,
  senderId: string,
  question: string,
  options: string[],
): Promise<void> {
  const draft = normalizePollDraft(question, options);
  if (draft.problem) {
    throw new Error(draft.problem);
  }

  // The poll holds the votes; a message with the same ID places it in the chat timeline.
  // Firestore rules require both documents, so they are written together.
  const pollRef = doc(collection(db, 'groups', groupId, 'polls'));
  const messageRef = doc(db, 'groups', groupId, 'messages', pollRef.id);
  const createdAt = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(pollRef, {
    createdBy: senderId,
    question: draft.question,
    options: draft.options,
    votes: {},
    createdAt,
  });
  batch.set(messageRef, {
    senderId,
    type: 'poll',
    question: draft.question,
    options: draft.options,
    createdAt,
  });
  await batch.commit();
}

export function watchPoll(
  groupId: string,
  pollId: string,
  onChange: (poll: GroupPoll | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(doc(db, 'groups', groupId, 'polls', pollId), (snapshot) => {
    // Polls posted before voting existed have a chat message but no poll document.
    onChange(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as GroupPoll) : null);
  }, onError);
}

export async function castPollVote(
  groupId: string,
  pollId: string,
  voterId: string,
  optionIndex: number,
): Promise<void> {
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= MAX_POLL_OPTIONS) {
    throw new Error('Choose one of the answers.');
  }
  // Votes are keyed by user ID, so voting again replaces that user's earlier choice.
  await updateDoc(doc(db, 'groups', groupId, 'polls', pollId), {
    [`votes.${voterId}`]: optionIndex,
  });
}

export function tallyPoll(options: string[], votes: Record<string, number>): PollTally {
  const counts = options.map(() => 0);
  for (const choice of Object.values(votes)) {
    // Skip anything that doesn't point at a current option.
    if (Number.isInteger(choice) && choice >= 0 && choice < counts.length) counts[choice]++;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  const percentages = counts.map((count) => (total === 0 ? 0 : Math.round((count / total) * 100)));
  const top = Math.max(0, ...counts);
  const winners = top === 0 ? [] : counts.flatMap((count, index) => (count === top ? [index] : []));
  return { counts, percentages, total, winners };
}
