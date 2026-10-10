import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { EditProfileScreen } from '@/features/profile/screens/EditProfileScreen';
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
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
}
