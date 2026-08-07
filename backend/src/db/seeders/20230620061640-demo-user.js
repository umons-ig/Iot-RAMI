"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ce seeder crée un compte ADMIN dont le hash bcrypt est committé (donc le
    // mot de passe est public : il figure dans le README). `init-db` étant la
    // procédure d'installation documentée, ce compte finissait en production.
    // On refuse de le créer en prod, sauf opt-in explicite pour une démo.
    // On SAUTE ce seeder (return) au lieu de lever : `db:seed:all` s'arrête à la
    // première exception, et ce fichier est le premier par ordre alphabétique.
    // Lever ici empêcherait les seeders de MeasurementTypes de s'exécuter, or
    // sans eux le consommateur Kafka ignore chaque mesure reçue : la plateforme
    // paraîtrait fonctionner tout en n'enregistrant aucune donnée patient.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEMO_SEED !== "true"
    ) {
      console.warn(
        "[seed] Compte de démo NON créé en production (son mot de passe est " +
          "public, le hash étant committé). Créez un administrateur avec un mot " +
          "de passe propre, ou forcez avec ALLOW_DEMO_SEED=true."
      );
      return;
    }

    await queryInterface.bulkInsert(
      "Users",
      [
        // ---------------------- ADMIN
        {
          id: "92dce105-f962-4ab7-9581-b693064f1778",
          email: "adriano@ig.umons.ac.be",
          password:
            "$2b$10$E8gcWD.v0dmNVT1Lgg5o.Oijop1yp9YPImkUU0ggP9iHMWmJzdPLG",
          role: "admin",
          firstName: "Adriano",
          lastName: "Doe",
          dateOfBirth: new Date("1980-01-01"),
          sex: "male",
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Users", null, {});
  },
};
