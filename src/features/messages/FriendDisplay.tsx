import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import type { MessageFriend } from '@/features/messages/useAcceptedMessageFriends';

export function friendDisplayName(friend: MessageFriend): string {
  return friend.profile?.displayName || friend.username;
}

export function friendSearchText(friend: MessageFriend): string {
  return `${friendDisplayName(friend)} ${friend.profile?.username || friend.username}`;
}

export function FriendAvatar({ friend, size = 54 }: {
  friend: MessageFriend;
  size?: number;
}) {
  const uri = friend.profile?.photoDataUrl || friend.profile?.photoURL;
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, dimensionStyle]} />;
  }

  const initial = friendDisplayName(friend).trim().charAt(0).toLocaleUpperCase() || '?';
  return (
    <View style={[styles.avatar, styles.fallback, dimensionStyle]}>
      <Text style={styles.initial}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.cardLighter },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontFamily: 'Moderustic_600SemiBold', fontSize: 20 },
});
