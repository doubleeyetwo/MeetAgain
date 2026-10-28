import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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

  // Polls share the messages collection so they appear in the chat timeline in order.
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    senderId,
    type: 'poll',
    question: draft.question,
    options: draft.options,
    createdAt: serverTimestamp(),
  });
}
