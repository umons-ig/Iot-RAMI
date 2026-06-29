import dotenv from "dotenv";

dotenv.config();

import MqttFog from "./mqttFog";
import { startMetricsServer } from "./metricsServer";
import { createManagementServer } from "./managementServer";
import { FirmwareUpdater } from "./firmwareUpdater";
import { METRICS_CONFIG, MANAGEMENT_CONFIG, FIRMWARE_CONFIG } from "./constants";
import type { Server } from "http";

let isShuttingDown = false;
let metricsServer: Server | undefined;
let managementServer: Server | undefined;
let firmwareUpdater: FirmwareUpdater | undefined;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[FogService] Signal ${signal} reçu — arrêt propre...`);
  try {
    metricsServer?.close();
    managementServer?.close();
    firmwareUpdater?.stop();
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
  const fog = await MqttFog.getInstance();
  // Serveur de métriques Prometheus (§3.1).
  metricsServer = startMetricsServer(METRICS_CONFIG.port, () =>
    fog.getMetricsSnapshot()
  );
  // Web server de gestion des ESP (liste + commandes à distance).
  managementServer = createManagementServer(
    fog,
    MANAGEMENT_CONFIG.port,
    MANAGEMENT_CONFIG.token,
    MANAGEMENT_CONFIG.host,
    MANAGEMENT_CONFIG.password,
  );
  // « Watchtower firmware » : poll GitHub Releases → OTA des ESP (opt-in).
  if (FIRMWARE_CONFIG.enabled) {
    firmwareUpdater = new FirmwareUpdater({
      repo: FIRMWARE_CONFIG.repo,
      envName: FIRMWARE_CONFIG.env,
      currentVersion: FIRMWARE_CONFIG.currentVersion,
      intervalMs: FIRMWARE_CONFIG.pollIntervalMs,
      onUpdateAvailable: (version) => {
        // URL Pages DIRECTE (pas la release github.com qui redirige) -> flash fiable.
        const url = `${FIRMWARE_CONFIG.otaBaseUrl}/${version}/rami-universal.bin`;
        const sent = fog.broadcastDeviceCommand({ cmd: "ota", url });
        console.log(`⬆️ [FogService] OTA ${version} (${url}) diffusée à ${sent} ESP`);
      },
    });
    firmwareUpdater.start();
  }
  console.log("✅ [FogService] Service démarré");
}

main().catch((error) => {
  console.error("❌ [FogService] Erreur fatale:", error);
  process.exit(1);
});
