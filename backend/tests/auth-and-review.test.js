import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/Worker.js", () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../models/Customer.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn() },
}));

vi.mock("../models/Review.js", () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../models/BlacklistedToken.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn() },
}));

vi.mock("../utils/otp.js", () => ({
  generateOtpCode: vi.fn(),
  saveOtp: vi.fn(),
  verifyOtpCode: vi.fn(),
  deliverOtp: vi.fn(),
}));

const [{ default: Worker }, { default: Review }, { default: BlacklistedToken }, { default: authRoutes }, { default: reviewRoutes }] = await Promise.all([
  import("../models/Worker.js"),
  import("../models/Review.js"),
  import("../models/BlacklistedToken.js"),
  import("../routes/authRoutes.js"),
  import("../routes/reviewRoutes.js"),
]);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/reviews", reviewRoutes);
  return app;
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-jwt";
  vi.clearAllMocks();
  BlacklistedToken.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
});

describe("registration, login, and reviews", () => {
  it("requires both private identity documents before worker registration", async () => {
    const response = await request(createApp())
      .post("/auth/worker/register")
      .send({
        name: "Test Worker",
        phone: "03001234567",
        password: "Password123",
        category: "Plumber",
        serviceArea: "Test Neighborhood",
        otp: "123456",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Upload a valid CNIC image");
    expect(Worker.create).not.toHaveBeenCalled();
  });

  it("returns a generic error when worker login phone is unregistered", async () => {
    Worker.findOne.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/auth/worker/login")
      .send({ phone: "03001234567", password: "Password123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid phone or password");
  });

  it("creates a customer review and strips submitted HTML", async () => {
    const worker = { _id: "507f1f77bcf86cd799439011", ratingAverage: 0, ratingCount: 0, save: vi.fn() };
    Worker.findById.mockResolvedValue(worker);
    Review.findOne.mockResolvedValue(null);
    Review.create.mockResolvedValue({ _id: "review-id", rating: 4, comment: "Great work" });
    Review.aggregate.mockResolvedValue([{ avg: 4, count: 1 }]);
    const token = jwt.sign({ id: "507f1f77bcf86cd799439012", role: "customer", jti: "customer-jti" }, process.env.JWT_SECRET);

    const response = await request(createApp())
      .post("/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({
        workerId: "507f1f77bcf86cd799439011",
        rating: 4,
        comment: "<b>Great work</b>",
      });

    expect(response.status).toBe(201);
    expect(Review.create).toHaveBeenCalledWith({
      worker: "507f1f77bcf86cd799439011",
      customer: "507f1f77bcf86cd799439012",
      rating: 4,
      comment: "Great work",
    });
    expect(worker.ratingAverage).toBe(4);
    expect(worker.ratingCount).toBe(1);
    expect(worker.save).toHaveBeenCalledOnce();
  });
});
