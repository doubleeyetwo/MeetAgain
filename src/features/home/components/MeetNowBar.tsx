import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LogoMark } from '@/components/Logo';
import { colors, fontFamily, spacing, text } from '@/theme';

export type MeetNowFriend = {
  id: string;
  name: string;
  photoURL?: string | null;
  // The signed-in user's own tile, shown while their switch is on.
  isSelf?: boolean;
  // Name the fallback initial comes from, when it is not the label. The user's
  // own tile reads "You" but still shows their own initial.
  avatarName?: string;
  // Friends only reach this list while they are free, so this marks the
  // signed-in user's own tile as sharing or not.
  available?: boolean;
};

type Props = {
  friends: MeetNowFriend[];
  // Whether the signed-in account is currently sharing that it is free.
  available: boolean;
  onToggle?: (next: boolean) => void;
  toggleDisabled?: boolean;
  loading?: boolean;
  error?: boolean;
  // Why the switch itself could not be read or saved, if it could not be.
  statusError?: string;
  onPressFriend?: (friend: MeetNowFriend) => void;
};

const AVATAR_SIZE = 76;
const BADGE_SIZE = 23;

function MeetNowAvatar({ friend }: { friend: MeetNowFriend }) {
  // Track the failed URI so a new profile photo gets a chance to load.
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photoURL = friend.photoURL;
  const initial =
    (friend.avatarName ?? friend.name).trim().charAt(0).toLocaleUpperCase() ||
    '?';

  return (
    <View style={styles.avatarWrap}>
      {photoURL && photoURL !== failedPhoto ? (
        <Image
          source={{ uri: photoURL }}
          onError={() => setFailedPhoto(photoURL)}
          style={[styles.avatar, friend.isSelf && styles.avatarSelf]}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.avatarFallback,
            friend.isSelf && styles.avatarSelf,
          ]}
        >
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View
        style={[
          styles.badge,
          friend.available === false && styles.badgeAway,
        ]}
      >
        {friend.available === false ? (
          <Ionicons name="moon" size={13} color={colors.white} />
        ) : null}
      </View>
    </View>
  );
}

export function MeetNowBar({
  friends,
  available,
  onToggle,
  toggleDisabled,
  loading,
  error,
  statusError,
  onPressFriend,
}: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.titleRow}>
        <LogoMark size={28} />
        <Text style={styles.titleText}>MeetNow</Text>

        {/* Same label as the Free Now Visibility switch in Privacy Settings. */}
        <View style={styles.togglePin}>
          <Switch
            accessibilityLabel="Free Now Visibility"
            value={available}
            disabled={toggleDisabled}
            onValueChange={onToggle}
            trackColor={{ true: colors.primaryAccent }}
          />
        </View>
      </View>

      {statusError ? (
        <Text accessibilityRole="alert" style={styles.statusError}>
          {statusError}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Could not load who is free right now.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Checking who is free...
          </Text>
        </View>
      ) : friends.length === 0 ? (
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
              accessibilityLabel={
                friend.isSelf
                  ? friend.available === false
                    ? 'You are not sharing that you are free'
                    : 'You are free now'
                  : `${friend.name} is free now`
              }
            >
              <MeetNowAvatar friend={friend} />

              <Text style={styles.name} numberOfLines={1}>
                {friend.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {friends.length === 1 && friends[0].isSelf ? (
        <Text style={[styles.emptyText, styles.onlyYou]}>
          {friends[0].available === false
            ? 'Turn on MeetNow to tell friends you are free.'
            : 'Only you so far. Friends who are free will show up here.'}
        </Text>
      ) : null}
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

  // Pinned to the edge so the title stays centred on the screen.
  togglePin: {
    position: 'absolute',
    right: spacing.md,
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

  // A ring marks the user's own tile apart from their friends'.
  avatarSelf: {
    borderWidth: 2,
    borderColor: colors.primaryAccent,
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
    alignItems: 'center',
    justifyContent: 'center',
  },

  // The user's own badge while they are not sharing that they are free.
  badgeAway: {
    backgroundColor: colors.trackMuted,
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

  onlyYou: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  statusError: {
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
});
