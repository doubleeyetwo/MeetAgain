import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '@/navigation/types';
import { MessageFeedScreen } from '@/features/messages/screens/MessageFeedScreen';
import { AddMembersScreen } from '@/features/messages/screens/AddMembersScreen';
import { ConversationScreen } from '@/features/messages/screens/ConversationScreen';
import { GroupOverviewScreen } from '@/features/messages/screens/GroupOverViewScreen';
import { GroupMembersScreen } from '@/features/messages/screens/GroupMembersScreen';
import { OtherProfileScreen } from '@/features/profile/screens/OtherProfileScreen';
import { EditGroupScreen } from '@/features/messages/screens/EditGroupScreen';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesNavigator() {
  return (
    <Stack.Navigator initialRouteName="MessageList" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessageList" component={MessageFeedScreen} />
      <Stack.Screen name="AddMembers" component={AddMembersScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="GroupOverview" component={GroupOverviewScreen} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} />
      <Stack.Screen name="MemberProfile" component={OtherProfileScreen} />
      <Stack.Screen name="GroupSettings" component={EditGroupScreen} />
    </Stack.Navigator>
  );
}
