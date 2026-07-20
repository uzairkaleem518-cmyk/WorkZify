import bcrypt from "bcryptjs";
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
  checkOtpCode: vi.fn(),
  deliverOtp: vi.fn(),
}));

vi.mock("../config/cloudinary.js", () => ({
  default: {
    uploader: {
      upload_stream: vi.fn((options, callback) => ({
        end: () => callback(null, { secure_url: "https://res.cloudinary.com/demo/image/upload/mock.jpg", public_id: "workzify/photos/mock", format: "jpg" }),
      })),
    },
    utils: { private_download_url: vi.fn() },
  },
}));

// streamifier pipes a real buffer into the (mocked) upload stream; the mock
// above ignores the piped data and just resolves with a fixed result, which
// is enough to exercise the route's success path.
vi.mock("streamifier", () => ({
  default: {
    createReadStream: () => ({
      pipe: (stream) => {
        stream.end();
        return stream;
      },
    }),
  },
}));

const [
  { default: Worker },
  { default: BlacklistedToken },
  { default: Review },
  { verifyOtpCode },
  { default: authRoutes },
  { default: reviewRoutes },
  { default: uploadRoutes },
] = await Promise.all([
  import("../models/Worker.js"),
  import("../models/BlacklistedToken.js"),
  import("../models/Review.js"),
  import("../utils/otp.js"),
  import("../routes/authRoutes.js"),
  import("../routes/reviewRoutes.js"),
  import("../routes/uploadRoutes.js"),
]);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/reviews", reviewRoutes);
  app.use("/uploads", uploadRoutes);
  return app;
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-jwt";
  vi.clearAllMocks();
  BlacklistedToken.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
});

describe("worker registration - success path consumes the OTP", () => {
  it("registers a worker and marks them pending after a valid OTP", async () => {
    verifyOtpCode.mockResolvedValue(true);
    Worker.findOne.mockResolvedValue(null); // no existing phone
    Worker.create.mockResolvedValue({ _id: "507f1f77bcf86cd799439099", verificationStatus: "pending" });

    const response = await request(createApp())
      .post("/auth/worker/register")
      .send({
        name: "Test Worker",
        phone: "03001234567",
        password: "Password123",
        category: "Plumber",
        serviceArea: "Test Neighborhood",
        otp: "123456",
        cnicImage: { publicId: "workzify/identity/cnic/abc", format: "jpg" },
        selfieImage: { publicId: "workzify/identity/selfies/abc", format: "jpg" },
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");
    // "register" purpose + consume=true is what verifyOtpCode (as opposed to
    // checkOtpCode) represents in utils/otp.js - this is the consumption step.
    expect(verifyOtpCode).toHaveBeenCalledWith("03001234567", "123456", "register");
    expect(Worker.create).toHaveBeenCalledOnce();
    expect(Worker.create.mock.calls[0][0]).toMatchObject({
      isPhoneVerified: true,
      verificationStatus: "pending",
    });
  });

  it("rejects registration when the OTP is invalid or already consumed", async () => {
    verifyOtpCode.mockResolvedValue(false);

    const response = await request(createApp())
      .post("/auth/worker/register")
      .send({
        name: "Test Worker",
        phone: "03001234567",
        password: "Password123",
        category: "Plumber",
        serviceArea: "Test Neighborhood",
        otp: "000000",
        cnicImage: { publicId: "workzify/identity/cnic/abc", format: "jpg" },
        selfieImage: { publicId: "workzify/identity/selfies/abc", format: "jpg" },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid or expired OTP");
    expect(Worker.create).not.toHaveBeenCalled();
  });
});

describe("worker login - success and failure", () => {
  it("logs a worker in with the correct password", async () => {
    const hashedPassword = await bcrypt.hash("Password123", 12);
    const worker = {
      _id: "507f1f77bcf86cd799439011",
      phone: "03001234567",
      password: hashedPassword,
      name: "Test Worker",
      category: "Plumber",
      verificationStatus: "approved",
      isAvailable: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      save: vi.fn(),
    };
    Worker.findOne.mockResolvedValue(worker);

    const response = await request(createApp())
      .post("/auth/worker/login")
      .send({ phone: "03001234567", password: "Password123" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.worker).toMatchObject({ phone: "03001234567", verificationStatus: "approved" });
    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(decoded.role).toBe("worker");
  });

  it("rejects a worker login with the wrong password without leaking which field was wrong", async () => {
    const hashedPassword = await bcrypt.hash("Password123", 12);
    const worker = {
      _id: "507f1f77bcf86cd799439011",
      phone: "03001234567",
      password: hashedPassword,
      failedLoginAttempts: 0,
      lockUntil: null,
      save: vi.fn(),
    };
    Worker.findOne.mockResolvedValue(worker);

    const response = await request(createApp())
      .post("/auth/worker/login")
      .send({ phone: "03001234567", password: "WrongPassword123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid phone or password");
    expect(worker.save).toHaveBeenCalledOnce(); // failed attempt was recorded
  });
});

describe("logout - blacklist behavior", () => {
  it("blacklists the token used to log out, and rejects that same token afterward", async () => {
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439012", role: "worker", jti: "session-jti-1" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // First call: token is not yet blacklisted, logout should succeed.
    const logoutResponse = await request(createApp())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);
    expect(BlacklistedToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ jti: "session-jti-1", role: "worker" })
    );

    // Second call with the SAME token: simulate that it is now blacklisted
    // (as it would be, since revokeToken just created that record) and
    // confirm the token is no longer accepted anywhere protectAny is used.
    BlacklistedToken.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ jti: "session-jti-1" }) });

    const secondAttempt = await request(createApp())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(secondAttempt.status).toBe(401);
    expect(secondAttempt.body.message).toBe("Token has been logged out");
  });
});

describe("review submission - duplicate handling", () => {
  it("rejects a second review from the same customer for the same worker", async () => {
    Worker.findById.mockResolvedValue({ _id: "507f1f77bcf86cd799439011" });
    Review.findOne.mockResolvedValue({ _id: "existing-review-id" });
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439012", role: "customer", jti: "customer-jti" },
      process.env.JWT_SECRET
    );

    const response = await request(createApp())
      .post("/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ workerId: "507f1f77bcf86cd799439011", rating: 5, comment: "Second try" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("You already reviewed this worker");
    expect(Review.create).not.toHaveBeenCalled();
  });

  it("falls back to the unique-index error code if a race lets a duplicate slip past the findOne check", async () => {
    Review.findOne.mockResolvedValue(null);
    const duplicateKeyError = Object.assign(new Error("duplicate key"), { code: 11000 });
    Review.create.mockRejectedValue(duplicateKeyError);
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439012", role: "customer", jti: "customer-jti" },
      process.env.JWT_SECRET
    );

    // Worker must resolve for the route to reach Review.create.
    Worker.findById.mockResolvedValue({ _id: "507f1f77bcf86cd799439011" });

    const response = await request(createApp())
      .post("/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ workerId: "507f1f77bcf86cd799439011", rating: 5, comment: "Race condition" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("You already reviewed this worker");
  });
});

describe("uploads - success paths", () => {
  it("uploads a profile photo successfully", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";

    const response = await request(createApp())
      .post("/uploads")
      .field("kind", "photo")
      .attach("image", Buffer.from("fake-image-bytes"), "photo.jpg");

    expect(response.status).toBe(201);
    expect(response.body.url).toContain("res.cloudinary.com");
    expect(response.body.publicId).toBeTruthy();
  });

  it("uploads an identity document after a valid (unconsumed) OTP check", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    const { checkOtpCode } = await import("../utils/otp.js");
    checkOtpCode.mockResolvedValue(true);

    const response = await request(createApp())
      .post("/uploads/identity")
      .field("phone", "03001234567")
      .field("otp", "123456")
      .field("kind", "cnic")
      .attach("image", Buffer.from("fake-image-bytes"), "cnic.jpg");

    expect(response.status).toBe(201);
    expect(response.body.document.publicId).toBeTruthy();
    expect(checkOtpCode).toHaveBeenCalledWith("03001234567", "123456", "register");
  });

  it("rejects an upload with a disallowed file type before ever calling Cloudinary", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";

    const response = await request(createApp())
      .post("/uploads")
      .field("kind", "photo")
      .attach("image", Buffer.from("not-an-image"), { filename: "notes.txt", contentType: "text/plain" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/JPG|PNG|WEBP/i);
  });
});