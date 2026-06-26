import {
  buildCommandPayload,
  handleCommand,
  DeviceCommandProvider,
} from "../managementServer";

describe("buildCommandPayload", () => {
  it("ota: nécessite une url", () => {
    expect(buildCommandPayload("ota", { url: "http://f/u.bin" })).toEqual({
      cmd: "ota",
      url: "http://f/u.bin",
    });
    expect(buildCommandPayload("ota", {})).toBeNull();
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
