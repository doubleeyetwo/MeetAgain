
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EventTemplatesScreen } from '@/features/events/screens/EventTemplatesScreen';
import { CreateEventScreen } from '@/features/events/screens/CreateEventScreen';
import { ReviewEventScreen } from '@/features/events/screens/ReviewEventScreen';

export type EventCreationStackParamList = {
  EventTemplates: undefined;

  EventDetails: {
    presetId?: string;
    category?: string;
  } | undefined;

  ReviewEvent: {
    eventName: string;
    category: string;
    presetId?: string;
  };
};

const Stack =
  createNativeStackNavigator<EventCreationStackParamList>();

export function EventCreationNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="EventTemplates"
      screenOptions={{
        headerShown: false,
      }}
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
        name="ReviewEvent"
        component={ReviewEventScreen}
      />
    </Stack.Navigator>
  );
}
