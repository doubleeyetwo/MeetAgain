import { NavigatorScreenParams } from '@react-navigation/native';

// Route params are deliberately limited to non-secret navigation state; signup credentials stay in AuthContext.
export type AuthStackParamList = {
  SignIn: undefined;
  Register: undefined;
  Password: { email: string };
  CreateProfile: undefined;
  ForgotPassword: undefined;
};
export type MainTabParamList = {
  Home: undefined;
  MeetNow: undefined;
  Friends: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  CreateEvent: undefined;
  EventDetails: { eventId: string };
};
