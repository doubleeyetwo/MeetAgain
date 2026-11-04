import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LogoMark } from '@/components/Logo';
import { colors, fontFamily, spacing, text } from '@/theme';

export type MeetNowFriend = {
  id: string;
  name: string;
  photoURL?: string | null;
};

type Props = {
  friends: MeetNowFriend[];
  onPressFriend?: (friend: MeetNowFriend) => void;
};

// Stand-in list so the bar renders before the Firestore side of #34 is built.
export const placeholderMeetNowFriends: MeetNowFriend[] = [
  { id: 'placeholder-1', name: 'Blake Garcia' },
  { id: 'placeholder-2', name: 'Ryan Carrasco' },
  { id: 'placeholder-3', name: 'Lela W' },
  { id: 'placeholder-4', name: 'Spencer' },
];

const AVATAR_SIZE = 76;
const BADGE_SIZE = 23;

function MeetNowAvatar({ friend }: { friend: MeetNowFriend }) {
  const initial =
    friend.name.trim().charAt(0).toLocaleUpperCase() || '?';

  return (
    <View style={styles.avatarWrap}>
      {friend.photoURL ? (
        <Image
          source={{ uri: friend.photoURL }}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View style={styles.badge} />
    </View>
  );
}

export function MeetNowBar({ friends, onPressFriend }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.titleRow}>
        <LogoMark size={28} />
        <Text style={styles.titleText}>MeetNow</Text>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No friends are free right now.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {friends.map((friend) => (
            <Pressable
              key={friend.id}
              style={styles.item}
              onPress={() => onPressFriend?.(friend)}
              accessibilityRole="button"
              accessibilityLabel={`${friend.name} is free now`}
            >
              <MeetNowAvatar friend={friend} />

              <Text style={styles.name} numberOfLines={1}>
                {friend.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.sm,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
  },

  titleText: {
    ...text.title,
    color: colors.white,
  },

  carousel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },

  item: {
    width: AVATAR_SIZE,
    alignItems: 'center',
    gap: spacing.sm,
  },

  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.cardLighter,
  },

  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarInitial: {
    ...text.title,
    color: colors.white,
  },

  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.online,
  },

  name: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.white,
    textAlign: 'center',
  },

  emptyState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },

  emptyText: {
    color: colors.linkAccent,
    fontSize: 13,
    textAlign: 'center',
  },
});
