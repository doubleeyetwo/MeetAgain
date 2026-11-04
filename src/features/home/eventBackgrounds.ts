
import type { ImageSourcePropType } from 'react-native';

const photos = {
  food: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&q=85',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1000&q=85',
  ],
  outdoors: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000&q=85',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&q=85',
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1000&q=85',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1000&q=85',
  ],
  study: [
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1000&q=85',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&q=85',
  ],
  sports: [
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1000&q=85',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&q=85',
  ],
  other: [
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1000&q=85',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&q=85',
  ],
};

function categoryPhotos(category: string): string[] {
  switch (category.toLowerCase()) {
    case 'food & dining':
      return photos.food;
    case 'outdoors':
      return photos.outdoors;
    case 'entertainment':
      return photos.entertainment;
    case 'study':
      return photos.study;
    case 'sports & fitness':
      return photos.sports;
    default:
      return photos.other;
  }
}

export function getEventBackground(
  category: string,
  eventId: string,
  eventPhoto?: string | null
): ImageSourcePropType {
  if (eventPhoto?.trim()) {
    return { uri: eventPhoto };
  }

  const options = categoryPhotos(category);

  // Stable selection: an event keeps the same fallback photo.
  const hash = Array.from(eventId).reduce(
    (value, character) => value + character.charCodeAt(0),
    0
  );

  return { uri: options[hash % options.length] };
}
