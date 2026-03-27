import request from "supertest";
import express from "express";
import transactionRoutes from "../../src/api/routes/transaction.routes";

describe("transaction API", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/transaction", transactionRoutes);

  test("POST sans JWT → 401", async () => {
    const res = await request(app).post("/api/v1/transaction").send({
      sessionId: "s1",
      userId: "00000000-0000-4000-8000-000000000001",
      country: "BJ",
      action: "balance",
      params: {},
      encryptedPin: "aes256:00:00",
    });
    expect(res.status).toBe(401);
  });
});
