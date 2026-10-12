export type EventSource = 'custom' | 'preset';

export type EventDraft = {
  source: EventSource;
  presetId?: string;

  name: string;
  category: string;
  photoUri?: string;

  memberIds: string[];

  startDate?: Date;
  endDate?: Date;

  location?: string;

  suggestedItems: string[];
};

export const createEmptyEventDraft = (): EventDraft => ({
  source: 'custom',
  name: '',
  category: '',
  memberIds: [],
  suggestedItems: [],
});