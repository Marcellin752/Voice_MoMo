process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-jest-minimum-32-chars!!";
process.env.PIN_ENCRYPTION_KEY =
  process.env.PIN_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.USE_MOCK_MODEM = "true";

/** Évite une connexion Redis réelle lors des imports de routes dans les tests. */
jest.mock("../src/queue/job-queue", () => ({
  ussdQueue: {
    add: jest.fn().mockResolvedValue({ id: "mock-job" }),
    getJob: jest.fn().mockResolvedValue(null),
  },
}));
