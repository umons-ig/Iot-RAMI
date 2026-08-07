import {
  buildCommandPayload,
  handleCommand,
  buildStatus,
  checkToken,
  isAuthorized,
  verifyPassword,
  sessionTokenFor,
  verifySessionToken,
  SESSION_TTL_MS,
  isLoginRateLimited,
  registerLoginFailure,
  clearLoginAttempts,
  DeviceCommandProvider,
} from "../managementServer";

describe("checkToken", () => {
  it("pas de token configuré -> REFUSÉ (fail-closed)", () => {
    expect(checkToken(undefined, "")).toBe(false);
    expect(checkToken("nimporte", "")).toBe(false);
  });
  it("token configuré -> exige une correspondance exacte", () => {
    expect(checkToken("secret", "secret")).toBe(true);
    expect(checkToken("mauvais", "secret")).toBe(false);
    expect(checkToken(undefined, "secret")).toBe(false);
    expect(checkToken("secre", "secret")).toBe(false); // longueur différente
  });
});

describe("isAuthorized", () => {
  it("aucune auth configurée -> REFUSÉ (fail-closed)", () => {
    // Sans MGMT_TOKEN ni MGMT_PASSWORD, l'API qui pousse l'OTA sur toute la
    // flotte doit rester fermée, pas s'ouvrir à tout le monde.
    expect(isAuthorized(undefined, "", "")).toBe(false);
    expect(isAuthorized("nimporte", "", "")).toBe(false);
  });
  it("token statique : correspondance exacte", () => {
    expect(isAuthorized("tok", "tok", "")).toBe(true);
    expect(isAuthorized("x", "tok", "")).toBe(false);
    expect(isAuthorized(undefined, "tok", "")).toBe(false);
  });
  it("jeton de session signé, valable sans état serveur", () => {
    const t = sessionTokenFor("pwd");
    expect(isAuthorized(t, "", "pwd")).toBe(true);
    expect(isAuthorized("autre", "", "pwd")).toBe(false);
    expect(isAuthorized(undefined, "", "pwd")).toBe(false); // mdp configuré -> auth requise
    // Un jeton émis pour un autre mot de passe ne passe pas.
    expect(isAuthorized(sessionTokenFor("autre-pwd"), "", "pwd")).toBe(false);
  });
});

describe("verifySessionToken", () => {
  it("accepte un jeton valide et non expiré", () => {
    expect(verifySessionToken(sessionTokenFor("pwd"), "pwd")).toBe(true);
  });
  it("refuse un jeton expiré", () => {
    const now = Date.now();
    const token = sessionTokenFor("pwd", SESSION_TTL_MS, now);
    expect(verifySessionToken(token, "pwd", now + SESSION_TTL_MS + 1)).toBe(false);
  });
  it("refuse une expiration falsifiée (la signature couvre l'expiration)", () => {
    const token = sessionTokenFor("pwd");
    const mac = token.slice(token.indexOf(".") + 1);
    const forged = `${Date.now() + 10 * 365 * 24 * 3600 * 1000}.${mac}`;
    expect(verifySessionToken(forged, "pwd")).toBe(false);
  });
  it("refuse un jeton malformé", () => {
    expect(verifySessionToken("", "pwd")).toBe(false);
    expect(verifySessionToken("sansPoint", "pwd")).toBe(false);
    expect(verifySessionToken(".abc", "pwd")).toBe(false);
    expect(verifySessionToken("abc.def", "pwd")).toBe(false);
  });
  it("ne révèle pas le mot de passe en clair", () => {
    expect(sessionTokenFor("pwd")).not.toContain("pwd");
  });
});

describe("limitation des tentatives de login", () => {
  it("bloque après 10 échecs puis se réarme après la fenêtre", () => {
    const ip = "10.0.0.42";
    clearLoginAttempts(ip);
    const now = Date.now();
    for (let i = 0; i < 9; i += 1) registerLoginFailure(ip, now);
    expect(isLoginRateLimited(ip, now)).toBe(false);
    registerLoginFailure(ip, now);
    expect(isLoginRateLimited(ip, now)).toBe(true);
    // La fenêtre est glissante : passé son terme, l'IP repart à zéro.
    expect(isLoginRateLimited(ip, now + 15 * 60 * 1000 + 1)).toBe(false);
    clearLoginAttempts(ip);
  });
  it("un login réussi remet le compteur à zéro", () => {
    const ip = "10.0.0.43";
    clearLoginAttempts(ip);
    const now = Date.now();
    for (let i = 0; i < 10; i += 1) registerLoginFailure(ip, now);
    expect(isLoginRateLimited(ip, now)).toBe(true);
    clearLoginAttempts(ip);
    expect(isLoginRateLimited(ip, now)).toBe(false);
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
  it("ota: exige une url HTTPS", () => {
    expect(buildCommandPayload("ota", { url: "https://f/u.bin" })).toEqual({
      cmd: "ota",
      url: "https://f/u.bin",
    });
    expect(buildCommandPayload("ota", {})).toBeNull();
    // http:// rejeté : en clair, un attaquant sur le chemin réseau substitue le
    // binaire et fait exécuter un firmware arbitraire sur le capteur.
    expect(buildCommandPayload("ota", { url: "http://f/u.bin" })).toBeNull();
    // Schémas non http(s) rejetés.
    expect(buildCommandPayload("ota", { url: "file:///etc/passwd" })).toBeNull();
    expect(buildCommandPayload("ota", { url: "ftp://x/y.bin" })).toBeNull();
    expect(buildCommandPayload("ota", { url: "javascript:alert(1)" })).toBeNull();
  });

  it("ota: http:// n'est accepté que via ALLOW_INSECURE_OTA (banc de test)", () => {
    const previous = process.env.ALLOW_INSECURE_OTA;
    process.env.ALLOW_INSECURE_OTA = "true";
    expect(buildCommandPayload("ota", { url: "http://f/u.bin" })).toEqual({
      cmd: "ota",
      url: "http://f/u.bin",
    });
    process.env.ALLOW_INSECURE_OTA = previous;
    expect(buildCommandPayload("ota", { url: "http://f/u.bin" })).toBeNull();
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
      getDeviceVersions: () => new Map(),
      getHaExposedTopics: () => new Set<string>(),
      setHaExposed: jest.fn().mockResolvedValue(undefined),
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
      url: "https://f/u.bin",
    });
    expect(r.status).toBe(200);
    expect(fog.publishDeviceCommand).toHaveBeenCalledWith("a-topic/sensor", {
      cmd: "ota",
      url: "https://f/u.bin",
    });
  });

  it("cible inconnue → 400 (pas de publication MQTT arbitraire)", () => {
    // Sans cette garde, la console publiait sur n'importe quel topic : bus
    // tiers (Zigbee2MQTT) ou réinjection vers le fog, abonné à `#`.
    const r = handleCommand(fog, {
      target: "zigbee2mqtt/bridge/request/permit_join",
      cmd: "restart",
    });
    expect(r.status).toBe(400);
    expect(fog.publishDeviceCommand).not.toHaveBeenCalled();
  });

  it("cmd manquante → 400", () => {
    expect(handleCommand(fog, { target: "all" }).status).toBe(400);
  });

  it("params invalides → 400", () => {
    expect(handleCommand(fog, { target: "all", cmd: "ota" }).status).toBe(400);
    expect(fog.broadcastDeviceCommand).not.toHaveBeenCalled();
  });
});
