import type { NavigatorScreenParams } from '@react-navigation/native';
import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';

// Route params are deliberately limited to non-secret navigation state; signup credentials stay in AuthContext.
export type AuthStackParamList = {
  SignIn: undefined;
  Register: undefined;
  Password: { email: string };
  CreateProfile: undefined;
  ForgotPassword: undefined;
  // The pasted reset code stays inside the screen; a live reset code is as sensitive as a password.
  ResetPassword: undefined;
};
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Friends: undefined;
  EditProfile: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  OtherProfile: { uid: string }
};

export type MainTabParamList = {
  Home: undefined;
  Messages: undefined;
  CreateEvent:
  | NavigatorScreenParams<EventCreationStackParamList>
  | undefined;
  Calendar: undefined;
  // Allow opening a specific profile screen, or selecting the tab normally.
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type MessagesStackParamList = {
  MessageList: undefined;
  // No params creates a group; groupId adds friends to an existing conversation.
  AddMembers: { groupId: string } | undefined;
  // Pass only the ID so each screen can load the group's current data.
  GroupOverview: { groupId: string };
  GroupMembers: { groupId: string };
  GroupSettings: { groupId: string };
  // Open another member's profile within Messages so Back returns to its caller.
  MemberProfile: { uid: string };
  Conversation:
  | {
      kind: 'friend';
      title: string;
      memberIds: string[];
      // Required ID for opening the direct conversation's message history.
      directConversationId: string;
    }
  | {
      kind: 'group';
      title: string;
      memberIds: string[];
      // Required ID for opening the group's message history.
      groupId: string;
    };
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  EventDetails: { eventId: string };
};
