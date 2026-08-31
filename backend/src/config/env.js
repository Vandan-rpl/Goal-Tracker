require("dotenv").config();

module.exports = {
  PORT: process.env.PORT,

  DB_SERVER: process.env.DB_SERVER,

  DB_USER: process.env.DB_USER,

  DB_PASSWORD: process.env.DB_PASSWORD,

  DB_NAME: process.env.DB_NAME,

  DB_PORT: process.env.DB_PORT,

  JWT_SECRET: process.env.JWT_SECRET,

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,

  NODE_ENV: process.env.NODE_ENV,
};