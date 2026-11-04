import { useEffect, useState } from 'react';
import { watchPoll, type GroupPoll } from '@/features/messages/polls';

type PollState = {
  key: string;
  poll: GroupPoll | null;
  loading: boolean;
  error: string | null;
};

// Follows one poll's live votes for the chat widget and the voting pop-up.
export function usePoll(groupId: string, pollId: string) {
  const key = `${groupId}/${pollId}`;
  const [state, setState] = useState<PollState>({ key, poll: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState({ key, poll: null, loading: true, error: null });
    const unsubscribe = watchPoll(
      groupId,
      pollId,
      (poll) => { if (active) setState({ key, poll, loading: false, error: null }); },
      (error) => { if (active) setState({ key, poll: null, loading: false, error: error.message }); },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId, pollId, key]);

  // Ignore a previous poll's data until this poll's first snapshot arrives.
  return state.key === key ? state : { key, poll: null, loading: true, error: null };
}
