import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator,} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppStackParamList, MainTabParamList } from './types';

import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { MessageFeedScreen } from '@/features/messages/screens/MessageFeedScreen';
import { EventCreationNavigator } from '@/features/events/navigation/EventCreationNavigator';
import { CalendarViewScreen } from '@/features/calendar/screens/CalendarViewScreen';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';

import { colors } from '@/theme';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function BottomTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const renderTab = (
    routeName: keyof MainTabParamList,
    iconName: keyof typeof Ionicons.glyphMap
  ) => {
    const route = state.routes.find(
      (item) => item.name === routeName
    );

    if (!route) {
      return null;
    }

    const routeIndex = state.routes.indexOf(route);
    const isFocused = state.index === routeIndex;

    return (
      <Pressable
        key={routeName}
        onPress={() => navigation.navigate(routeName)}
        style={{
          flex: 1,
          height: 82,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={iconName}
          size={24}
          color={
            isFocused
              ? colors.primaryAccent
              : colors.white
          }
        />
      </Pressable>
    );
  };

  return (
    <View
      style={{
        height: 78,
        backgroundColor: colors.footer,
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 2,
      }}
    >
      {renderTab('Home', 'home-outline')}

      {renderTab('Messages', 'chatbubble-outline')}

      <View
        style={{
          flex: 1,
          height: 82,
          alignItems: 'center',
        }}
      >
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
          <Pressable
            onPress={() => navigation.navigate('CreateEvent')}
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
          </Pressable>
        </View>
      </View>

      {renderTab('Calendar', 'calendar-outline')}

      {renderTab('Profile', 'person-outline')}
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.bg,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
      />

      <Tabs.Screen
        name="Messages"
        component={MessageFeedScreen}
      />

      <Tabs.Screen 
      name="CreateEvent" 
      component={EventCreationNavigator} />

      <Tabs.Screen
        name="Calendar"
        component={CalendarViewScreen}
      />

      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.bg,
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
      />
    </Stack.Navigator>
  );
}
