require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT_OUT || "5432", 10),
  dialect: "postgres",
  "migrations-path": "../src/db/migrations",
};

module.exports = {
  development: { ...base, host: process.env.DB_HOST || "localhost" },
  local: { ...base, host: process.env.DB_HOST || "localhost" },
  preproduction: { ...base, host: process.env.DB_HOST },
  production: { ...base, host: process.env.DB_HOST },
};
