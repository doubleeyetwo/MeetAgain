import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppStackParamList, MainTabParamList } from './types';
import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { MeetNowScreen } from '@/features/events/screens/MeetNowScreen';
import { FriendsScreen } from '@/features/friends/screens/FriendsScreen';
import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { CreateEventScreen } from '@/features/events/screens/CreateEventScreen';
import { colors } from '@/theme';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,

        tabBarActiveTintColor: colors.primaryAccent,
        tabBarInactiveTintColor: colors.white,

        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = 'home-outline';
              break;

            case 'MeetNow':
              iconName = 'chatbubble-outline';
              break;

            case 'Friends':
              iconName = 'add';
              break;

            case 'Notifications':
              iconName = 'calendar-outline';
              break;

            case 'Profile':
              iconName = 'person-outline';
              break;

            default:
              iconName = 'ellipse-outline';
          }

          // Temporary center tab.
          // This will eventually open CreateEvent instead of Friends.
          if (route.name === 'Friends') {
            return (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.footer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ translateY: -22 }],
                }}
              >
                <View
                  style={{
                    width: 55,
                    height: 55,
                    borderRadius: 28,
                    backgroundColor: colors.primaryAccent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name="add"
                    size={30}
                    color={colors.white}
                  />
                </View>
              </View>
            );
          }

          return (
            <View
              style={{
                height: 75,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={iconName}
                size={24}
                color={color}
              />
            </View>
          );
        },

        tabBarStyle: {
          backgroundColor: colors.footer,
          height: 82,
          borderTopWidth: 0,
          paddingTop: 10,
        },

        tabBarItemStyle: {
          height: 75,
        },
      })}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
      />

      <Tabs.Screen
        name="MeetNow"
        component={MeetNowScreen}
      />

      <Tabs.Screen
        name="Friends"
        component={FriendsScreen}
      />

      <Tabs.Screen
        name="Notifications"
        component={NotificationsScreen}
      />

      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tabs.Navigator>
  );
}

// Keep event creation above the tab shell so it can be
// opened from any main tab.
export function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{ title: 'Create event' }}
      />
    </Stack.Navigator>
  );
}
