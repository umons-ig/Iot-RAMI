"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
