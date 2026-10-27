import { NavigatorScreenParams } from '@react-navigation/native';

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
  CreateEvent: undefined;
  Calendar: undefined;
  Profile: undefined;
};

export type MessagesStackParamList = {
  MessageList: undefined;
  AddMembers: undefined;
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
