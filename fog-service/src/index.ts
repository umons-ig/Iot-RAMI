import dotenv from "dotenv";

dotenv.config();

import MqttFog from "./mqttFog";

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[FogService] Signal ${signal} reçu — arrêt propre...`);
  try {
    const fog = await MqttFog.getInstance();
    await fog.shutdown();
  } catch (error) {
    console.error("❌ [FogService] Erreur durant l'arrêt:", error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch(() => process.exit(1));
});
process.on("SIGINT", () => {
  shutdown("SIGINT").catch(() => process.exit(1));
});

async function main() {
  console.log("🚀 [FogService] Démarrage...");
  await MqttFog.getInstance();
  console.log("✅ [FogService] Service démarré");
}

main().catch((error) => {
  console.error("❌ [FogService] Erreur fatale:", error);
  process.exit(1);
});
