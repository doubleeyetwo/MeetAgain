import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '@/navigation/types';
import { MessageFeedScreen } from '@/features/messages/screens/MessageFeedScreen';
import { AddMembersScreen } from '@/features/messages/screens/AddMembersScreen';
import { ConversationScreen } from '@/features/messages/screens/ConversationScreen';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesNavigator() {
  return (
    <Stack.Navigator initialRouteName="MessageList" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessageList" component={MessageFeedScreen} />
      <Stack.Screen name="AddMembers" component={AddMembersScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
    </Stack.Navigator>
  );
}
