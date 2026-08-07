interface DiscoveredSensor {
  baseTopic: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
}

export const discoveredTopics = new Map<string, DiscoveredSensor>();

/**
 * Ce registre est alimenté DIRECTEMENT par les payloads Kafka, donc par une
 * entrée non maîtrisée : Kafka est en PLAINTEXT sans authentification, et le
 * fog peut relayer un topic arbitraire. Sans plafond ni validation, il suffisait
 * de publier des topics aléatoires pour faire croître cette Map jusqu'à
 * épuiser la mémoire du backend.
 */
const MAX_DISCOVERED_TOPICS = 500;
const MAX_TOPIC_LENGTH = 256;
// Jeu de caractères des topics MQTT réellement utilisés par le projet.
const VALID_TOPIC = /^[A-Za-z0-9/_.:-]+$/;

export const isValidDiscoveredTopic = (baseTopic: unknown): boolean =>
  typeof baseTopic === "string" &&
  baseTopic.length > 0 &&
  baseTopic.length <= MAX_TOPIC_LENGTH &&
  VALID_TOPIC.test(baseTopic);

export const addDiscoveredTopic = (baseTopic: string): void => {
  if (!isValidDiscoveredTopic(baseTopic)) return;

  const existing = discoveredTopics.get(baseTopic);
  const now = new Date().toISOString();
  if (existing) {
    existing.lastSeenAt = now;
    existing.count++;
    return;
  }

  // Plafond atteint : on évince l'entrée vue le moins récemment (LRU), pour que
  // le registre reste utile aux capteurs actifs plutôt que gelé sur du bruit.
  if (discoveredTopics.size >= MAX_DISCOVERED_TOPICS) {
    let oldestKey: string | undefined;
    let oldestSeen = Infinity;
    for (const [key, value] of discoveredTopics) {
      const seen = Date.parse(value.lastSeenAt);
      if (seen < oldestSeen) {
        oldestSeen = seen;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) discoveredTopics.delete(oldestKey);
  }

  discoveredTopics.set(baseTopic, {
    baseTopic,
    firstSeenAt: now,
    lastSeenAt: now,
    count: 1,
  });
};
