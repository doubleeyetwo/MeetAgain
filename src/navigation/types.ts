import { NavigatorScreenParams } from '@react-navigation/native';

// Route params are deliberately limited to non-secret navigation state; signup credentials stay in AuthContext.
export type AuthStackParamList = {
  SignIn: undefined;
  Register: undefined;
  Password: { email: string };
  CreateProfile: undefined;
  ForgotPassword: undefined;
};
export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Messages: undefined;
  CreateEvent: undefined;
  Calendar: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  EventDetails: { eventId: string };
};
