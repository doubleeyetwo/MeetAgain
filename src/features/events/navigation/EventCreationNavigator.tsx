import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EventTemplatesScreen } from '@/features/events/screens/EventTemplatesScreen';
import { CreateEventScreen } from '@/features/events/screens/CreateEventScreen';

export type EventCreationStackParamList = {
  EventTemplates: undefined;
  EventDetails: undefined;
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
    </Stack.Navigator>
  );
}