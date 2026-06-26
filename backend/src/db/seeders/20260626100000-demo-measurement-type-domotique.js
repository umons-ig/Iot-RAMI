"use strict";

/**
 * Types de mesure domotique « classiques » (présence, luminosité, contact,
 * qualité d'air) — alignés avec les drivers ESP32 ajoutés (PIR, BH1750, reed,
 * SGP30) et l'auto-discover des appareils Zigbee2MQTT.
 *
 * Les types médicaux (spo2, heart_rate, body_temperature, gsr) sont déjà seedés.
 *
 * @type {import('sequelize-cli').Migration}
 */
const TYPES = [
  { id: "b3c4d5e6-0001-4000-8000-000000000001", name: "occupancy" },
  { id: "b3c4d5e6-0001-4000-8000-000000000002", name: "illuminance" },
  { id: "b3c4d5e6-0001-4000-8000-000000000003", name: "contact" },
  { id: "b3c4d5e6-0001-4000-8000-000000000004", name: "co2" },
  { id: "b3c4d5e6-0001-4000-8000-000000000005", name: "tvoc" },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("MeasurementTypes", TYPES, {
      ignoreDuplicates: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("MeasurementTypes", {
      name: TYPES.map((t) => t.name),
    });
  },
};
