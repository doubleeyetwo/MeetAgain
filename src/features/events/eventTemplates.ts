
// Event templates: single source of truth for template names,
// categories, icons, and prefilled Items and Tasks.

export type EventTemplate = {
  id: string;
  name: string;
  category: string;
  icon: string;
  items: readonly string[];
  tasks: readonly string[];
};

export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    id: 'hiking',
    name: 'Hiking',
    category: 'Outdoors',
    icon: 'trail-sign-outline',
    items: [
      'Water',
      'Sunscreen',
      'Trail snacks',
      'Hiking shoes',
      'First aid kit',
    ],
    tasks: [
      'Choose a hiking trail',
      'Check the weather',
      'Arrange transportation',
    ],
  },
  {
    id: 'campfire',
    name: 'Campfire',
    category: 'Outdoors',
    icon: 'bonfire-outline',
    items: [
      'Firewood',
      'Lighter or matches',
      'Blankets',
      'Marshmallows',
      'Chocolate and graham crackers',
      'Bug spray',
    ],
    tasks: [
      'Find or reserve a fire pit',
      'Check fire restrictions',
      'Plan transportation',
      'Clean up after the event',
    ],
  },
  {
    id: 'study-session',
    name: 'Study Session',
    category: 'Study',
    icon: 'book-outline',
    items: [
      'Laptop and charger',
      'Notes and textbooks',
      'Pens and highlighters',
      'Water',
      'Snacks',
    ],
    tasks: [
      'Reserve a study room',
      'Choose topics to review',
      'Prepare study materials',
    ],
  },
  {
    id: 'dinner',
    name: 'Dinner',
    category: 'Food & Dining',
    icon: 'restaurant-outline',
    items: [],
    tasks: [
      'Choose a restaurant',
      'Make a reservation',
      'Check dietary restrictions',
      'Arrange transportation',
    ],
  },
  {
    id: 'movie-night',
    name: 'Movie Night',
    category: 'Entertainment',
    icon: 'film-outline',
    items: [
      'Popcorn',
      'Snacks',
      'Drinks',
      'Blankets',
      'Pillows',
    ],
    tasks: [
      'Choose a movie',
      'Set up the movie area',
      'Check streaming availability',
    ],
  },
  {
    id: 'beach-day',
    name: 'Beach Day',
    category: 'Outdoors',
    icon: 'sunny-outline',
    items: [
      'Sunscreen',
      'Water',
      'Beach towels',
      'Swimsuit',
      'Sunglasses',
      'Beach umbrella',
      'Snacks',
    ],
    tasks: [
      'Choose a beach',
      'Check the weather',
      'Arrange transportation',
      'Plan parking',
    ],
  },
  {
    id: 'game-night',
    name: 'Game Night',
    category: 'Entertainment',
    icon: 'game-controller-outline',
    items: [
      'Board games or cards',
      'Snacks',
      'Drinks',
      'Extra controllers',
    ],
    tasks: [
      'Choose games to play',
      'Set up the gaming area',
      'Explain game rules',
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    category: 'Entertainment',
    icon: 'bag-handle-outline',
    items: [
      'Shopping list',
      'Reusable bags',
      'Wallet or payment app',
    ],
    tasks: [
      'Choose stores to visit',
      'Set a budget',
      'Plan transportation',
    ],
  },
];

// Find the selected template using its ID.
export function getTemplate(
  presetId: string | undefined
): EventTemplate | undefined {
  if (!presetId) return undefined;

  return EVENT_TEMPLATES.find(
    (template) => template.id === presetId
  );
}

// Return copies of the template's Items and Tasks.
// Custom events and unknown template IDs return empty lists.
export function getItemsForPreset(
  presetId: string | undefined
): string[] {
  return [...(getTemplate(presetId)?.items ?? [])];
}

export function getTasksForPreset(
  presetId: string | undefined
): string[] {
  return [...(getTemplate(presetId)?.tasks ?? [])];
}

// Parameters passed to the next screen after selecting a template.
export type TemplateDetailsParams = {
  presetId: string;
  category: string;
  eventName: string;
};

// Build fresh parameters whenever a template is selected.
// This prevents old template defaults from being reused.
export function buildTemplateParams(
  template: EventTemplate
): TemplateDetailsParams {
  return {
    presetId: template.id,
    category: template.category,
    eventName: template.name,
  };
}
