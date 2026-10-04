import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStackParamList, MainTabParamList } from './types';
import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { MeetNowScreen } from '@/features/events/screens/MeetNowScreen';
import { FriendsScreen } from '@/features/friends/screens/FriendsScreen';
import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { CreateEventScreen } from '@/features/events/screens/CreateEventScreen';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="MeetNow" component={MeetNowScreen} />
      <Tabs.Screen name="Friends" component={FriendsScreen} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

// Keep event creation above the tab shell so it can be opened from any main tab.
export function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Create event' }} />
    </Stack.Navigator>
  );
}
