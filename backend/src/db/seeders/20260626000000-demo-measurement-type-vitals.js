"use strict";

/**
 * Constantes physiologiques (vitaux) cohérentes avec le contexte médical du
 * projet (ECG AD8232). Ces types complètent ceux déjà seedés :
 *   - demo-measurement-type        : ecg, temperature, humidity, pressure
 *   - demo-measurement-type-mmwave : breathing_rate, heart_rate, distance,
 *                                    x_position, y_position, people_count
 *
 * NB : `respiration_rate` n'est PAS ajouté car `breathing_rate` (radar mmWave)
 * couvre déjà la fréquence respiratoire — éviter deux noms pour la même mesure.
 * De même, `heart_rate` existe déjà (donc pas de `bpm`).
 *
 * @type {import('sequelize-cli').Migration}
 */
const VITALS = [
  { id: "a2b3c4d5-0001-4000-8000-000000000001", name: "spo2" },
  { id: "a2b3c4d5-0001-4000-8000-000000000002", name: "blood_pressure_systolic" },
  { id: "a2b3c4d5-0001-4000-8000-000000000003", name: "blood_pressure_diastolic" },
  { id: "a2b3c4d5-0001-4000-8000-000000000004", name: "body_temperature" },
  { id: "a2b3c4d5-0001-4000-8000-000000000005", name: "gsr" },
];

module.exports = {
  async up(queryInterface) {
    // ignoreDuplicates : idempotent si un type a déjà été créé via l'auto-discover.
    await queryInterface.bulkInsert("MeasurementTypes", VITALS, {
      ignoreDuplicates: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("MeasurementTypes", {
      name: VITALS.map((v) => v.name),
    });
  },
};
