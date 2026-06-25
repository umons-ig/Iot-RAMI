import {
  getAccessibleSensorIds,
  userHasSensorAccess,
  zoneGrantedSensorIds,
} from "@service/sensorAccess";
import db from "@db/index";

// On mocke uniquement les modèles utilisés par le service d'accès.
jest.mock("@db/index", () => ({
  UserSensorAccess: { findOne: jest.fn(), findAll: jest.fn() },
  UserZoneAccess: { findAll: jest.fn() },
  TeamMember: { findAll: jest.fn() },
  TeamZoneAccess: { findAll: jest.fn() },
  Zone: { findAll: jest.fn() },
  Sensor: { findAll: jest.fn() },
}));

const DB = db as any;

const SENSOR_A = "11111111-1111-4111-8111-111111111111";
const SENSOR_B = "22222222-2222-4222-8222-222222222222";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  jest.clearAllMocks();
  // Par défaut : aucun accès par zone (toutes les requêtes zone renvoient vide).
  DB.UserZoneAccess.findAll.mockResolvedValue([]);
  DB.TeamMember.findAll.mockResolvedValue([]);
  DB.TeamZoneAccess.findAll.mockResolvedValue([]);
  DB.Zone.findAll.mockResolvedValue([]);
  DB.Sensor.findAll.mockResolvedValue([]);
});

describe("userHasSensorAccess", () => {
  test("retourne true sur un accès direct ACCEPTED", async () => {
    DB.UserSensorAccess.findOne.mockResolvedValue({ id: "grant-1" });

    await expect(userHasSensorAccess(USER, SENSOR_A)).resolves.toBe(true);
    expect(DB.UserSensorAccess.findOne).toHaveBeenCalledWith({
      where: { userId: USER, sensorId: SENSOR_A, status: "accepted" },
    });
  });

  test("retourne false sans accès direct ni accès par zone (fail-closed)", async () => {
    DB.UserSensorAccess.findOne.mockResolvedValue(null);

    await expect(userHasSensorAccess(USER, SENSOR_A)).resolves.toBe(false);
  });

  test("retourne true si le capteur est accessible via une zone accordée", async () => {
    DB.UserSensorAccess.findOne.mockResolvedValue(null);
    DB.UserZoneAccess.findAll.mockResolvedValue([{ zoneId: "zone-1" }]);
    DB.Sensor.findAll.mockResolvedValue([{ id: SENSOR_A }]);

    await expect(userHasSensorAccess(USER, SENSOR_A)).resolves.toBe(true);
  });
});

describe("getAccessibleSensorIds", () => {
  test("fusionne accès direct et accès par zone, sans doublon", async () => {
    DB.UserSensorAccess.findAll.mockResolvedValue([
      { sensorId: SENSOR_A },
      { sensorId: SENSOR_B },
    ]);
    DB.UserZoneAccess.findAll.mockResolvedValue([{ zoneId: "zone-1" }]);
    // Le capteur A est aussi rattaché à la zone accordée -> dédupliqué.
    DB.Sensor.findAll.mockResolvedValue([{ id: SENSOR_A }]);

    const ids = await getAccessibleSensorIds(USER);

    expect(ids.sort()).toEqual([SENSOR_A, SENSOR_B].sort());
  });

  test("renvoie un tableau vide quand aucun accès", async () => {
    DB.UserSensorAccess.findAll.mockResolvedValue([]);

    await expect(getAccessibleSensorIds(USER)).resolves.toEqual([]);
  });
});

describe("zoneGrantedSensorIds (fail-closed)", () => {
  test("renvoie [] si un modèle d'accès par zone lève une erreur", async () => {
    DB.UserZoneAccess.findAll.mockRejectedValue(new Error("DB down"));

    await expect(zoneGrantedSensorIds(USER)).resolves.toEqual([]);
  });
});
