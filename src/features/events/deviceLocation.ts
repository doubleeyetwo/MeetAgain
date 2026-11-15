import * as Location from 'expo-location';

export type DeviceCoords = {
  latitude: number;
  longitude: number;
};

// 'denied' is the planner refusing the prompt, which the fallback in #52 keys
// off. 'unavailable' is everything else: services switched off, or a granted
// permission that still cannot produce a fix.
export type DeviceLocationResult =
  | { status: 'granted'; coords: DeviceCoords }
  | { status: 'denied' }
  | { status: 'unavailable' };

export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  // With services off the permission request resolves as a denial, so check
  // first to keep the two cases apart for the message the screen shows.
  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return { status: 'unavailable' };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    return { status: 'denied' };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      // Suggestions are chosen by neighborhood, so a block-level fix is enough
      // and settles faster than Accuracy.High.
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      status: 'granted',
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}
