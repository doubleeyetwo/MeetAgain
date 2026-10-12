import { useEffect, useRef, useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/features/auth/AuthContext';
import { findUserByUsername, Friendship, PublicUser, respondToFriendRequest, sendFriendRequest, watchFriendships } from '@/features/friends/friendships';
import { AppStackParamList } from '@/navigation/types';

export function FriendsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<PublicUser | null>(null);
  const [searched, setSearched] = useState(false);
  const [relationships, setRelationships] = useState<Friendship[]>([]);
  const [relationshipsLoading, setRelationshipsLoading] = useState(true);
  const [relationshipsError, setRelationshipsError] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const searchSequence = useRef(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsubscribe = watchFriendships(user.uid, (items) => {
      setRelationships(items);
      setRelationshipsLoading(false);
      setRelationshipsError(false);
      // Resolve names from public username records; other users' private
      // profiles are never read to render a request or the friends list.
      const usernames = [...new Set(items.flatMap((item) => [item.requesterUsername, item.recipientUsername]))];
      void Promise.all(usernames.map(async (username) => {
        try {
          const found = await findUserByUsername(username);
          return [username, found?.displayName ?? username] as const;
        } catch {
          return [username, username] as const;
        }
      })).then((pairs) => {
        if (active) setNames(Object.fromEntries(pairs));
      });
    }, () => {
      if (active) {
        setRelationshipsLoading(false);
        setRelationshipsError(true);
        setError('Could not load friendships. Please try again later.');
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [user]);

  const search = async () => {
    if (busy) return;
    const sequence = ++searchSequence.current;
    setBusy('search');
    setError('');
    setSearched(false);
    setSearchResult(null);
    try {
      const result = await findUserByUsername(searchText);
      if (sequence !== searchSequence.current) return;
      setSearchResult(result);
      setSearched(true);
    } catch (cause) {
      if (sequence === searchSequence.current) {
        setError(cause instanceof Error && cause.message.startsWith('Enter a username')
          ? cause.message : 'Could not search for users. Please try again.');
      }
    } finally {
      if (sequence === searchSequence.current) setBusy('');
    }
  };

  const send = async () => {
    if (!user || !searchResult || busy) return;
    setBusy('send');
    setError('');
    try {
      await sendFriendRequest(user.uid, searchResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send request. Please try again.');
    } finally { setBusy(''); }
  };

  const respond = async (friendship: Friendship, response: 'accepted' | 'declined') => {
    if (!user || busy) return;
    setBusy(friendship.id);
    setError('');
    try {
      await respondToFriendRequest(friendship, user.uid, response);
    } catch {
      setError('Could not update this request. Please try again.');
    } finally { setBusy(''); }
  };

  const foundRelationship = relationships.find((item) => searchResult && item.memberIds.includes(searchResult.uid));
  const canSend = !relationshipsLoading && !relationshipsError && searchResult && searchResult.uid !== user?.uid && (
    !foundRelationship || (foundRelationship.status === 'declined' && foundRelationship.requesterId === user?.uid)
  );
  const incoming = relationships.filter((item) => item.status === 'pending' && item.recipientId === user?.uid);
  const outgoing = relationships.filter((item) => item.status === 'pending' && item.requesterId === user?.uid);
  const friends = relationships.filter((item) => item.status === 'accepted');
  const otherPerson = (item: Friendship) => item.requesterId === user?.uid
    ? item.recipientUsername : item.requesterUsername;

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Friends</Text>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Button title="Back" onPress={() => navigation.goBack()} />
        <Text style={styles.body}>Search by exact username to find a person.</Text>
        <TextInput
          value={searchText}
          editable={!busy}
          onChangeText={(value) => {
            ++searchSequence.current;
            setSearchText(value);
            setSearchResult(null);
            setSearched(false);
          }}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
          accessibilityLabel="Username to search"
          style={styles.input}
        />
        <Button title={busy === 'search' ? 'Searching...' : 'Search'} onPress={search} disabled={!!busy || !searchText.trim()} />
        {searched && !searchResult ? <Text style={styles.body}>No user found.</Text> : null}
        {searchResult ? (
          <View style={styles.row}>
            <Text style={styles.body}>{searchResult.displayName}</Text>
            <Text style={styles.body}>@{searchResult.username}</Text>
            {searchResult.uid === user?.uid ? <Text style={styles.body}>This is you.</Text> : null}
            {foundRelationship?.status === 'accepted' ? <Text style={styles.body}>Friends</Text> : null}
            {foundRelationship?.status === 'pending' ? (
              <Text style={styles.body}>{foundRelationship.requesterId === user?.uid ? 'Request sent' : 'Request received below'}</Text>
            ) : null}
            {foundRelationship?.status === 'declined' && !canSend ? <Text style={styles.body}>Request declined</Text> : null}
            {canSend ? (
              <Button title={busy === 'send' ? 'Sending...' : foundRelationship ? 'Send request again' : 'Add Friend'} onPress={send} disabled={!!busy} />
            ) : null}
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
        {relationshipsLoading ? <Text style={styles.body}>Loading requests and friends...</Text> : null}

        <Text style={styles.body}>Requests to you ({incoming.length})</Text>
        {incoming.length === 0 ? <Text style={styles.body}>No new requests.</Text> : incoming.map((item) => {
          const username = otherPerson(item);
          return (
            <View key={item.id} style={styles.row}>
              <Text style={styles.body}>{names[username] ?? username}</Text>
              <Text style={styles.body}>@{username}</Text>
              <View style={styles.actions}>
                <Button title="Accept" onPress={() => respond(item, 'accepted')} disabled={!!busy} />
                <Button title="Decline" onPress={() => respond(item, 'declined')} disabled={!!busy} />
              </View>
            </View>
          );
        })}
        <Text style={styles.body}>Sent requests ({outgoing.length})</Text>
        {outgoing.length === 0 ? <Text style={styles.body}>No pending requests.</Text> : outgoing.map((item) => {
          const username = otherPerson(item);
          return <Text key={item.id} style={styles.body}>{names[username] ?? username} (@{username})</Text>;
        })}
        <Text style={styles.body}>Friends ({friends.length})</Text>
        {friends.length === 0 ? <Text style={styles.body}>Accepted friends will appear here.</Text> : friends.map((item) => {
          const username = otherPerson(item);
          return <Text key={item.id} style={styles.body}>{names[username] ?? username} (@{username})</Text>;
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { color: '#000' },
  content: { gap: 12, paddingBottom: 16 },
  body: { color: '#000' },
  input: { color: '#000' },
  row: { gap: 4 },
  actions: { gap: 4 },
});
