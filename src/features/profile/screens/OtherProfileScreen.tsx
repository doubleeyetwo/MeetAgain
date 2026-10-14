import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { PublicProfile } from '@/types/models';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'OtherProfile'
>;

// Memory tiles are 104x93 at a 367pt frame width; keep the ratio and let the row divide the width.
const TILE_ASPECT = 104 / 93;
const TILE_RADIUS = 10;
const GRID_GAP = 10;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* Render the stored ISO date as the design's "July 24th, 2003". */
function formatBirthday(iso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return '';
  const year = match[1];
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month) return '';
  const remainder = day % 100;
  const suffix =
    remainder >= 11 && remainder <= 13
      ? 'th'
      : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
  return `${month} ${day}${suffix}, ${year}`;
}

type Memory = { id: string; photoUrl: string };

function MemoriesGrid({ memories }: { memories: Memory[] }) {
  if (memories.length === 0) {
    return (
      <View style={styles.emptyMemories}>
        <Ionicons name="images-outline" size={32} color={colors.white} />
        <Text style={styles.emptyMemoriesText}>Events you attend will show up here.</Text>
      </View>
    );
  }

  // Pad the final row so three tiles per row keep their width.
  const rows: (Memory | null)[][] = [];
  for (let index = 0; index < memories.length; index += 3) {
    const row: (Memory | null)[] = memories.slice(index, index + 3);
    while (row.length < 3) row.push(null);
    rows.push(row);
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((memory, cellIndex) =>
            memory ? (
              <Image key={memory.id} source={{ uri: memory.photoUrl }} style={styles.tile} />
            ) : (
              <View key={`empty-${cellIndex}`} style={styles.tileSpacer} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

export function OtherProfileScreen({ navigation }: Props) {
  // This screen will receive its public profile in the follow-up data-loading step.
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const birthday = formatBirthday(profile?.dateOfBirth);

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarWrap}>
            {profile?.photoDataUrl || profile?.photoURL ? (
              <Image
                source={{ uri: profile.photoDataUrl ?? profile.photoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={44} color={colors.white} />
              </View>
            )}
          </View>

          <Text style={styles.name}>{profile?.displayName ?? ''}</Text>
          {profile?.username ? <Text style={styles.username}>@{profile.username}</Text> : null}

          <View style={styles.stats}>
            {/* Counts do not have data sources yet, so keep the profile placeholders at zero. */}
            <Text style={styles.statText}>0 posts</Text>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.statText}>0 Friends</Text>
          </View>

          {birthday ? <Text style={styles.birthday}>{birthday}</Text> : null}
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <MemoriesGrid memories={[]} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default OtherProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  avatarWrap: { marginTop: spacing.sm },
  avatar: { width: 99, height: 99, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: colors.cardDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...text.body,
    fontSize: 20,
    letterSpacing: 0.2,
    color: colors.white,
    marginTop: spacing.md,
  },
  username: { ...text.body, color: colors.white, opacity: 0.7, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statText: { ...text.body, color: colors.white },
  statDot: { ...text.body, color: colors.white },
  birthday: { ...text.body, color: colors.white, marginTop: spacing.xs },
  bio: {
    ...text.body,
    color: colors.white,
    textAlign: 'center',
    width: 228,
    marginTop: spacing.lg,
  },
  grid: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: GRID_GAP,
  },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  tile: { flex: 1, aspectRatio: TILE_ASPECT, borderRadius: TILE_RADIUS },
  tileSpacer: { flex: 1 },
  emptyMemories: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyMemoriesText: { ...text.body, color: colors.white, opacity: 0.6, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
