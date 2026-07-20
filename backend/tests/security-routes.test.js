import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/Worker.js", () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../models/BlacklistedToken.js", () => ({
  default: { findOne: vi.fn() },
}));

vi.mock("../utils/otp.js", () => ({
  checkOtpCode: vi.fn(),
}));

vi.mock("../config/cloudinary.js", () => ({
  default: {
    uploader: { upload_stream: vi.fn() },
    utils: { private_download_url: vi.fn() },
  },
}));

const [{ default: Worker }, { default: BlacklistedToken }, { checkOtpCode }, { default: workerRoutes }, { default: adminRoutes }, { default: uploadRoutes }] = await Promise.all([
  import("../models/Worker.js"),
  import("../models/BlacklistedToken.js"),
  import("../utils/otp.js"),
  import("../routes/workerRoutes.js"),
  import("../routes/adminRoutes.js"),
  import("../routes/uploadRoutes.js"),
]);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/workers", workerRoutes);
  app.use("/admin", adminRoutes);
  app.use("/uploads", uploadRoutes);
  return app;
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-jwt";
  vi.clearAllMocks();
  BlacklistedToken.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
});

describe("worker privacy and identity verification", () => {
  it("does not expose a pending worker through the public profile route", async () => {
    const select = vi.fn().mockResolvedValue(null);
    Worker.findOne.mockReturnValue({ select });

    const response = await request(createApp()).get("/workers/507f1f77bcf86cd799439011");

    expect(response.status).toBe(404);
    expect(Worker.findOne).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439011",
      verificationStatus: "approved",
    });
  });

  it("rejects an identity-document upload without a valid registration OTP", async () => {
    checkOtpCode.mockResolvedValue(false);

    const response = await request(createApp())
      .post("/uploads/identity")
      .field("phone", "03001234567")
      .field("otp", "123456")
      .field("kind", "cnic")
      .attach("image", Buffer.from("test-image"), "cnic.jpg");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid or expired OTP");
  });

  it("prevents admin approval until both private identity documents exist", async () => {
    Worker.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        identityDocuments: { cnic: { publicId: "workzify/identity/cnic/one" } },
      }),
    });
    const token = jwt.sign({ id: "507f1f77bcf86cd799439012", role: "admin", jti: "test-jti" }, process.env.JWT_SECRET);

    const response = await request(createApp())
      .patch("/admin/workers/507f1f77bcf86cd799439011/approve")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("CNIC and selfie documents are required before approval");
    expect(Worker.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a worker token on an admin-only approval route", async () => {
    const token = jwt.sign({ id: "507f1f77bcf86cd799439012", role: "worker", jti: "worker-jti" }, process.env.JWT_SECRET);

    const response = await request(createApp())
      .patch("/admin/workers/507f1f77bcf86cd799439011/approve")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Forbidden");
    expect(Worker.findById).not.toHaveBeenCalled();
  });
});
