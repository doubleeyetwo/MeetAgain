import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { MessagesStackParamList } from '@/navigation/types';
import { PublicProfile } from '@/types/models';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversation'>;

export function ConversationScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { kind, title, memberIds } = route.params;
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(kind === 'group');

  useEffect(() => {
    let active = true;
    if (kind !== 'group' || !user) { setLoading(false); setProfiles({}); return; }
    setLoading(true);
    const otherIds = memberIds.filter((uid) => uid !== user.uid);
    void Promise.all(otherIds.map(async (uid) => {
      try {
        const snapshot = await getDoc(doc(db, collections.publicProfiles, uid));
        return snapshot.exists() ? [uid, { id: snapshot.id, ...snapshot.data() } as PublicProfile] as const : null;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!active) return;
      setProfiles(Object.fromEntries(entries.filter((entry): entry is readonly [string, PublicProfile] => entry !== null)));
      setLoading(false);
    });
    return () => { active = false; };
  }, [kind, memberIds.join('|'), user?.uid]);

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back to messages" hitSlop={12} onPress={() => navigation.goBack()} style={styles.side}>
            <Ionicons name="chevron-back" size={25} color={colors.white} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <View style={styles.side} />
        </View>
        {kind === 'group' ? (
          <View style={styles.memberSection}>
            <Text style={styles.sectionTitle}>Members</Text>
            {loading ? <ActivityIndicator color={colors.white} /> : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.members}>
                {memberIds.map((uid) => {
                  const profile = uid === user?.uid ? null : profiles[uid];
                  const displayName = uid === user?.uid ? 'You' : profile?.displayName || 'Unavailable member';
                  const photo = profile?.photoDataUrl || profile?.photoURL;
                  return (
                    <View key={uid} style={styles.member}>
                      {photo ? <Image source={{ uri: photo }} style={styles.memberAvatar} /> : <View style={[styles.memberAvatar, styles.avatarFallback]}><Ionicons name="person" size={20} color={colors.white} /></View>}
                      <Text numberOfLines={1} style={styles.memberName}>{displayName}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name={kind === 'group' ? 'people' : 'chatbubble'} size={28} color={colors.white} /></View>
          <Text style={styles.emptyText}>Messages will appear here.</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  side: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.title, flex: 1, color: colors.white, textAlign: 'center' },
  memberSection: { marginTop: spacing.md, paddingHorizontal: spacing.lg },
  sectionTitle: { ...text.header, color: colors.white, marginBottom: spacing.sm },
  members: { gap: spacing.md, paddingVertical: spacing.sm },
  member: { width: 76, alignItems: 'center', gap: spacing.xs },
  memberAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.cardLighter },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  memberName: { ...text.body, color: colors.white, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 48 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.cardLighter, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...text.body, color: 'rgba(244,241,247,0.8)', fontSize: 16 },
});
