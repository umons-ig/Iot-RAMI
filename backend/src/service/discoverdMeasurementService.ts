interface DiscoveredMeasurement {
  measurementType: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
}

export const discoveredMeasurements = new Map<string, DiscoveredMeasurement>();

export const addDiscoveredMeasurement = (measurement: string): void => {
  const existing = discoveredMeasurements.get(measurement);
  const now = new Date().toISOString();
  if (existing) {
    existing.lastSeenAt = now;
    existing.count++;
  } else {
    discoveredMeasurements.set(measurement, {
      measurementType: measurement,
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1,
    });
  }
};
