import {
  buildCommandPayload,
  handleCommand,
  buildStatus,
  checkToken,
  isAuthorized,
  verifyPassword,
  DeviceCommandProvider,
} from "../managementServer";

describe("checkToken", () => {
  it("pas de token configuré -> autorisé", () => {
    expect(checkToken(undefined, "")).toBe(true);
    expect(checkToken("nimporte", "")).toBe(true);
  });
  it("token configuré -> exige une correspondance exacte", () => {
    expect(checkToken("secret", "secret")).toBe(true);
    expect(checkToken("mauvais", "secret")).toBe(false);
    expect(checkToken(undefined, "secret")).toBe(false);
    expect(checkToken("secre", "secret")).toBe(false); // longueur différente
  });
});

describe("isAuthorized", () => {
  it("aucune auth configurée -> autorisé", () => {
    expect(isAuthorized(undefined, "", "", new Set())).toBe(true);
  });
  it("token statique : correspondance exacte", () => {
    expect(isAuthorized("tok", "tok", "", new Set())).toBe(true);
    expect(isAuthorized("x", "tok", "", new Set())).toBe(false);
    expect(isAuthorized(undefined, "tok", "", new Set())).toBe(false);
  });
  it("session de login : jeton présent dans le set", () => {
    const s = new Set(["sess1"]);
    expect(isAuthorized("sess1", "", "pwd", s)).toBe(true);
    expect(isAuthorized("autre", "", "pwd", s)).toBe(false);
    expect(isAuthorized(undefined, "", "pwd", s)).toBe(false); // mdp configuré -> auth requise
  });
});

describe("verifyPassword", () => {
  it("vrai seulement si correspondance exacte (et mdp configuré)", () => {
    expect(verifyPassword("abc", "abc")).toBe(true);
    expect(verifyPassword("abc", "abcd")).toBe(false);
    expect(verifyPassword("", "abc")).toBe(false);
    expect(verifyPassword("abc", "")).toBe(false);
  });
});

describe("buildStatus", () => {
  it("agrège le snapshot + devices + uptime et calcule healthy", () => {
    const s = buildStatus(
      { outboxPending: 3, kafkaConnected: true, drops: 0, bufferSize: 12 },
      2,
      42.7,
    );
    expect(s).toMatchObject({
      outboxPending: 3,
      kafkaConnected: true,
      devices: 2,
      uptimeSec: 43,
      healthy: true,
    });
  });

  it("healthy=false si Kafka déconnecté ou outbox indisponible", () => {
    expect(
      buildStatus({ outboxPending: 0, kafkaConnected: false, drops: 0, bufferSize: 0 }, 0, 1).healthy,
    ).toBe(false);
    expect(
      buildStatus({ outboxPending: -1, kafkaConnected: true, drops: 0, bufferSize: 0 }, 0, 1).healthy,
    ).toBe(false);
  });
});

describe("buildCommandPayload", () => {
  it("ota: nécessite une url http(s) valide", () => {
    expect(buildCommandPayload("ota", { url: "http://f/u.bin" })).toEqual({
      cmd: "ota",
      url: "http://f/u.bin",
    });
    expect(buildCommandPayload("ota", { url: "https://f/u.bin" })).toMatchObject({ cmd: "ota" });
    expect(buildCommandPayload("ota", {})).toBeNull();
    // Schémas non http(s) rejetés.
    expect(buildCommandPayload("ota", { url: "file:///etc/passwd" })).toBeNull();
    expect(buildCommandPayload("ota", { url: "ftp://x/y.bin" })).toBeNull();
    expect(buildCommandPayload("ota", { url: "javascript:alert(1)" })).toBeNull();
  });

  it("set_wifi: nécessite un ssid, pass optionnel", () => {
    expect(buildCommandPayload("set_wifi", { ssid: "lab", pass: "x" })).toEqual({
      cmd: "set_wifi",
      ssid: "lab",
      pass: "x",
    });
    expect(buildCommandPayload("set_wifi", { ssid: "lab" })).toEqual({
      cmd: "set_wifi",
      ssid: "lab",
      pass: "",
    });
    expect(buildCommandPayload("set_wifi", {})).toBeNull();
  });

  it("set_mqtt: au moins un champ", () => {
    expect(buildCommandPayload("set_mqtt", { broker: "10.0.0.1" })).toMatchObject({
      cmd: "set_mqtt",
      broker: "10.0.0.1",
    });
    expect(buildCommandPayload("set_mqtt", {})).toBeNull();
  });

  it("restart/ping/start/stop: sans paramètre", () => {
    expect(buildCommandPayload("restart", {})).toEqual({ cmd: "restart" });
    expect(buildCommandPayload("ping", {})).toEqual({ cmd: "ping" });
  });

  it("commande inconnue → null", () => {
    expect(buildCommandPayload("rm -rf", {})).toBeNull();
  });
});

describe("handleCommand", () => {
  let fog: DeviceCommandProvider & {
    publishDeviceCommand: jest.Mock;
    broadcastDeviceCommand: jest.Mock;
  };

  beforeEach(() => {
    fog = {
      getKnownDevices: () => ["a-topic/sensor", "b-topic/sensor"],
      publishDeviceCommand: jest.fn(),
      broadcastDeviceCommand: jest.fn().mockReturnValue(2),
      getMetricsSnapshot: jest
        .fn()
        .mockResolvedValue({ outboxPending: 0, kafkaConnected: true, drops: 0, bufferSize: 0 }),
    };
  });

  it("cible 'all' → broadcast", () => {
    const r = handleCommand(fog, { target: "all", cmd: "restart" });
    expect(r.status).toBe(200);
    expect(fog.broadcastDeviceCommand).toHaveBeenCalledWith({ cmd: "restart" });
    expect(r.body).toMatchObject({ sent: 2, target: "all" });
  });

  it("absence de target → broadcast (tous)", () => {
    handleCommand(fog, { cmd: "restart" });
    expect(fog.broadcastDeviceCommand).toHaveBeenCalled();
  });

  it("cible spécifique → publishDeviceCommand", () => {
    const r = handleCommand(fog, {
      target: "a-topic/sensor",
      cmd: "ota",
      url: "http://f/u.bin",
    });
    expect(r.status).toBe(200);
    expect(fog.publishDeviceCommand).toHaveBeenCalledWith("a-topic/sensor", {
      cmd: "ota",
      url: "http://f/u.bin",
    });
  });

  it("cmd manquante → 400", () => {
    expect(handleCommand(fog, { target: "all" }).status).toBe(400);
  });

  it("params invalides → 400", () => {
    expect(handleCommand(fog, { target: "all", cmd: "ota" }).status).toBe(400);
    expect(fog.broadcastDeviceCommand).not.toHaveBeenCalled();
  });
});
