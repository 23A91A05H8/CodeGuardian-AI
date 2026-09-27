import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import mongoose from "mongoose";
import { app } from "../server";
import { config } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { User } from "../src/models/User";
import { Analysis } from "../src/models/Analysis";

let server: http.Server;
let baseUrl: string;
let testToken = "";
const testEmail = `testuser_${Date.now()}@example.com`;
const testPassword = "Password123!";

before(async () => {
  // Ensure DB connection is active
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  try {
    await User.deleteMany({ email: { $regex: /@example\.com$/ } });
    await Analysis.deleteMany({ code: "def add(a, b): return a + b" });
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    setTimeout(() => process.exit(0), 200).unref();
  }
});

describe("CodeGuardian AI Backend API Tests", () => {
  test("GET /api/health responds with JSON status and database connected", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data: any = await res.json();
    assert.ok(data.services, "Should have services status");
    assert.strictEqual(data.services.backend, "healthy");
    assert.strictEqual(data.services.database, "connected");
  });

  test("POST /api/auth/register fails on invalid email or short password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "not-an-email",
        password: "123",
      }),
    });
    const data: any = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.message, "Validation failed");
    assert.ok(data.errors && data.errors.length >= 2, "Should return multiple validation errors");
  });

  test("POST /api/auth/register succeeds with valid details and returns JWT token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Developer",
        email: testEmail,
        password: testPassword,
      }),
    });
    const data: any = await res.json();
    assert.strictEqual(res.status, 201);
    assert.ok(data.token, "Should receive JWT token");
    assert.strictEqual(data.user.email, testEmail.toLowerCase());
    testToken = data.token;
  });

  test("POST /api/auth/register rejects duplicate email with 409 Conflict", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate User",
        email: testEmail,
        password: testPassword,
      }),
    });
    assert.strictEqual(res.status, 409);
  });

  test("POST /api/auth/login succeeds with correct password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const data: any = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.token);
  });

  test("POST /api/auth/login rejects wrong password with 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword999!",
      }),
    });
    assert.strictEqual(res.status, 401);
  });

  test("GET /api/auth/me returns user profile when authenticated", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    const data: any = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.user.email, testEmail.toLowerCase());
  });

  test("GET /api/auth/me rejects unauthenticated request with 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(res.status, 401);
  });

  test("POST /api/analyze rejects unauthenticated request with 401", async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "print('hello')",
        analysisType: "explain",
      }),
    });
    assert.strictEqual(res.status, 401);
  });

  test("POST /api/analyze validates analysisType enum", async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        code: "print('hello')",
        analysisType: "invalid_type",
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  test("GET /api/report/:id rejects invalid ObjectId format with 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/report/not-a-valid-object-id`, {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    assert.strictEqual(res.status, 400);
  });

  test("GET /api/dashboard returns structured metrics for authenticated user", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    const data: any = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(typeof data.totalAnalyses === "number");
    assert.ok(Array.isArray(data.recent));
  });
});
