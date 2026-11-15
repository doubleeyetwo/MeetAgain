// Rules for which events count as past events on a profile.
// This file has no React Native or Firebase imports so `npm test` can run it under plain Node.

type Instant = { toMillis(): number };

export type TimedEvent = {
  endAt: Instant;
  participantIds: string[];
  status?: string;
};

// An event is upcoming until its end time, and past from then on.
export function hasEnded(event: Pick<TimedEvent, 'endAt'>, now: number): boolean {
  return event.endAt.toMillis() <= now;
}

/*
 * The profile owner's finished events, most recently ended first.
 * `events` must already be limited to what the viewer may read; the event rules
 * only return events the viewer was invited to. Keeping only the ones the
 * profile owner also attended means another person's profile shows the past
 * events the two shared, and never an event the viewer was not invited to.
 */
export function selectPastEvents<T extends TimedEvent>(
  events: T[],
  profileUid: string,
  now: number,
): T[] {
  return events
    .filter((event) =>
      event.status === 'confirmed'
      && event.participantIds.includes(profileUid)
      && hasEnded(event, now))
    .sort((a, b) => b.endAt.toMillis() - a.endAt.toMillis());
}
