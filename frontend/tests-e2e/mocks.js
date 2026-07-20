// Shared fixtures + route mocks so each smoke test only has to describe
// which endpoints matter for that particular flow.

export const CATEGORIES = ["Plumber", "Electrician", "Driver"];

export const WORKER_SEARCH_RESULTS = {
  workers: [
    {
      _id: "w1",
      name: "Ali Raza",
      category: "Plumber",
      serviceArea: "Gulberg",
      ratingAverage: 4.6,
      ratingCount: 12,
      isAvailable: true,
      verificationStatus: "approved",
    },
  ],
  pagination: { page: 1, hasMore: false },
};

export const APPROVED_WORKER_PROFILE = {
  _id: "w1",
  name: "Ali Raza",
  category: "Plumber",
  serviceArea: "Gulberg",
  ratingAverage: 4.6,
  ratingCount: 12,
  fee: "PKR 800/visit",
  experienceYears: 5,
  isAvailable: true,
  verificationStatus: "approved",
  cnicImageUrl: "https://res.cloudinary.com/demo/image/upload/cnic.jpg",
  selfieUrl: "https://res.cloudinary.com/demo/image/upload/selfie.jpg",
};

// Mocks GET /api/workers/categories, used on both Home and WorkerRegister.
export async function mockCategories(page) {
  await page.route("**/api/workers/categories", (route) =>
    route.fulfill({ json: CATEGORIES })
  );
}

export async function mockWorkerSearch(page, results = WORKER_SEARCH_RESULTS) {
  await page.route("**/api/workers?*", (route) => route.fulfill({ json: results }));
}

export async function mockOtpSend(page, { devCode = "123456" } = {}) {
  await page.route("**/api/auth/otp/send", (route) =>
    route.fulfill({ json: { message: "OTP sent", channel: "dev", devCode } })
  );
}

export async function mockWorkerLogin(page, { status = 200 } = {}) {
  await page.route("**/api/auth/worker/login", (route) =>
    status === 200
      ? route.fulfill({
          json: { token: "fake-worker-jwt", worker: { name: "Ali Raza" } },
        })
      : route.fulfill({ status: 401, json: { message: "Invalid phone or password" } })
  );
}

export async function mockWorkerProfileMe(page, profile = APPROVED_WORKER_PROFILE) {
  await page.route("**/api/workers/me/profile", (route) => route.fulfill({ json: profile }));
}

// AdminDashboard fires off /admin/stats (and, depending on the active tab,
// /admin/workers or /admin/reviews) right after mount. These aren't the
// point of the admin-login smoke test, but leaving them unmocked would hit
// a real network call, so we stub the minimum to keep the test hermetic.
export async function mockAdminDashboardData(page) {
  await page.route("**/api/admin/stats", (route) =>
    route.fulfill({ json: { totalWorkers: 0, pendingWorkers: 0, totalReviews: 0 } })
  );
  await page.route("**/api/admin/workers*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/admin/reviews", (route) => route.fulfill({ json: [] }));
}

export async function mockAdminLogin(page, { status = 200 } = {}) {
  await page.route("**/api/admin/login", (route) =>
    status === 200
      ? route.fulfill({ json: { token: "fake-admin-jwt" } })
      : route.fulfill({ status: 401, json: { message: "Invalid credentials" } })
  );
}
