const requiredEnv = [
  "PORT",
  "DB_SERVER",
  "DB_DATABASE",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
];

const validateEnv = () => {
  const missing = requiredEnv.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing Environment Variables: ${missing.join(", ")}`
    );
  }
};

module.exports = validateEnv;