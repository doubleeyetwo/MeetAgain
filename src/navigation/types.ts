
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';

// Route params are deliberately limited to non-secret navigation state;
// signup credentials stay in AuthContext.
export type AuthStackParamList = {
  SignIn: undefined;
  Register: undefined;
  Password: { email: string };
  CreateProfile: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Friends: undefined;
  EditProfile: undefined;
  Settings: undefined;
  PrivacySettings: undefined;
  ChangePassword: undefined;
  OtherProfile: { uid: string };
};

export type MainTabParamList = {
  Home: undefined;
  Messages: undefined;
  CreateEvent:
    | NavigatorScreenParams<EventCreationStackParamList>
    | undefined;
  Calendar: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type MessagesStackParamList = {
  MessageList: undefined;
  AddMembers: { groupId: string } | undefined;
  GroupOverview: { groupId: string };
  GroupMembers: { groupId: string };
  GroupSettings: { groupId: string };
  MemberProfile: { uid: string };
  Conversation:
    | {
        kind: 'friend';
        title: string;
        memberIds: string[];
        directConversationId: string;
      }
    | {
        kind: 'group';
        title: string;
        memberIds: string[];
        groupId: string;
      };
};

// Parameters for editing an existing event.
// These routes reuse the original creation screen components.
export type SavedEventEditParams = {
  editingEventId: string;
  eventName: string;
  category: string;
  eventPhoto?: string | null;
  location?: string;
  startAt?: string;
  endAt?: string;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  EventDetails: { eventId: string };
  EditEventDetails: SavedEventEditParams;
  EditEventLocation: SavedEventEditParams;
  EditEventTime: SavedEventEditParams;
};
