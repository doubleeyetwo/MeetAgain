import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { EditProfileScreen } from '@/features/profile/screens/EditProfileScreen';
import { SettingsScreen } from '@/features/profile/screens/SettingsScreen';
import { ChangePasswordScreen } from '@/features/profile/screens/ChangePasswordScreen';
import { OtherProfileScreen } from '@/features/profile/screens/OtherProfileScreen';
import { FriendsScreen } from '@/features/friends/screens/FriendsScreen';
import { ProfileStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Nested inside the Profile tab so the bottom bar stays visible, matching the frames.
export function ProfileNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ProfileHome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="OtherProfile" component={OtherProfileScreen} />
    </Stack.Navigator>
  );
}
