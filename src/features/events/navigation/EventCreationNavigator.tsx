
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EventTemplatesScreen } from '@/features/events/screens/EventTemplatesScreen';
import { CreateEventScreen } from '@/features/events/screens/CreateEventScreen';
import { PickTimeScreen } from '@/features/events/screens/PickTimeScreen';
import { SelectMembersScreen } from '@/features/events/screens/SelectMembersScreen';
import { ReviewEventScreen } from '@/features/events/screens/ReviewEventScreen';

export type EventCreationStackParamList = {
  EventTemplates: undefined;

  EventDetails:
    | {
        presetId?: string;
        category?: string;
      }
    | undefined;

  PickTime: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
  };

  SelectMembers: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
    startAt: string;
    endAt: string;
  };

  ReviewEvent: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
    startAt: string;
    endAt: string;
    selectedMemberIds: string[];
  };
};

const Stack =
  createNativeStackNavigator<EventCreationStackParamList>();

export function EventCreationNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="EventTemplates"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name="EventTemplates"
        component={EventTemplatesScreen}
      />
      <Stack.Screen
        name="EventDetails"
        component={CreateEventScreen}
      />
      <Stack.Screen
        name="PickTime"
        component={PickTimeScreen}
      />
      <Stack.Screen
        name="SelectMembers"
        component={SelectMembersScreen}
      />
      <Stack.Screen
        name="ReviewEvent"
        component={ReviewEventScreen}
      />
    </Stack.Navigator>
  );
}
