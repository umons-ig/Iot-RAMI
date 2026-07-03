interface DiscoveredSensor {
  baseTopic: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
}

export const discoveredTopics = new Map<string, DiscoveredSensor>();

export const addDiscoveredTopic = (baseTopic: string): void => {
  const existing = discoveredTopics.get(baseTopic);
  const now = new Date().toISOString();
  if (existing) {
    existing.lastSeenAt = now;
    existing.count++;
  } else {
    discoveredTopics.set(baseTopic, {
      baseTopic,
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1,
    });
  }
};
