
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EventTemplatesScreen } from '@/features/events/screens/EventTemplatesScreen';
import { CreateEventScreen } from '@/features/events/screens/CreateEventScreen';
import { PickTimeScreen } from '@/features/events/screens/PickTimeScreen';
import { SelectMembersScreen } from '@/features/events/screens/SelectMembersScreen';
import { PickLocationScreen } from '@/features/events/screens/PickLocationScreen';
import { ReviewEventScreen } from '@/features/events/screens/ReviewEventScreen';


export type EventCreationStackParamList = {
  EventTemplates: undefined;

  EventDetails:
    | {
        presetId?: string;
        category?: string;
        eventName?: string;
        eventPhoto?: string | null;
        location?: string;
        startAt?: string;
        endAt?: string;
        selectedMemberIds?: string[];
        editingFromReview?: boolean;
      }
    | undefined;

  PickLocation: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
    location?: string;
    startAt?: string;
    endAt?: string;
    selectedMemberIds?: string[];
    editingFromReview?: boolean;
  };

  PickTime: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
    location?: string;
    startAt?: string;
    endAt?: string;
    selectedMemberIds?: string[];
    editingFromReview?: boolean;
  };

  SelectMembers: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
    startAt: string;
    endAt: string;
    location?: string;
  };

  ReviewEvent: {
    eventName: string;
    category: string;
    presetId?: string;
    eventPhoto?: string | null;
    startAt: string;
    endAt: string;
    selectedMemberIds: string[];
    matchingGroupId?: string;
    location?: string;
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
        name="PickLocation"
        component={PickLocationScreen}
      />
      <Stack.Screen
        name="ReviewEvent"
        component={ReviewEventScreen}
      />
    </Stack.Navigator>
  );
}
