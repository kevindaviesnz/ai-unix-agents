/**
 * api.js
 * REST API route handlers for the user-facing service.
 */

import { login, validateSession, deleteSession } from "./auth.js";

// TODO: add input validation middleware (e.g. zod or joi)
// TODO: add request logging middleware
// TODO: add CORS configuration

const MAX_PAYLOAD_SIZE = 1048576; // 1MB — FIXME: not actually enforced yet

// HACK: global request counter because we haven't set up metrics yet
let requestCount = 0;

/**
 * Handles POST /login
 */
export function handleLogin(req, res) {
  requestCount++;
  console.log(`[handleLogin] Request #${requestCount}`, req.body);

  const { username, password } = req.body;

  if (!username || !password) {
    console.log("Missing credentials in request");
    return res.status(400).json({ error: "Username and password are required" });
  }

  // TODO: sanitize username to prevent injection attacks
  const result = login(username, password);

  if (!result.success) {
    // FIXME: don't leak whether the username exists vs wrong password
    console.log("Login failed:", result.error);
    return res.status(401).json({ error: result.error });
  }

  console.log("Login successful, token:", result.token); // XXX security risk
  return res.status(200).json({ token: result.token });
}

/**
 * Handles GET /profile
 */
export function handleGetProfile(req, res) {
  requestCount++;
  const token = req.headers["authorization"]?.replace("Bearer ", "");

  console.log("Profile request with token:", token); // XXX remove before prod

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const session = validateSession(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  // TODO: fetch real profile data from database
  // Returning hardcoded data for now
  return res.status(200).json({
    userId: session.userId,
    email: "placeholder@example.com", // FIXME: pull from DB
    plan: "free",
  });
}

/**
 * Handles POST /logout
 */
export function handleLogout(req, res) {
  requestCount++;
  const token = req.headers["authorization"]?.replace("Bearer ", "");

  if (!token) {
    return res.status(400).json({ error: "No token provided" });
  }

  deleteSession(token);
  console.log("User logged out, token invalidated:", token);
  return res.status(200).json({ message: "Logged out successfully" });
}

/**
 * Handles GET /health
 * TODO: add actual dependency checks (DB, cache, external APIs)
 */
export function handleHealth(req, res) {
  // HACK: always returns healthy even if dependencies are down
  return res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    requests: requestCount,
  });
}

// XXX: dead code — was used during testing, never removed
export function debugDumpSessions(req, res) {
  console.log("WARNING: dumping all active sessions"); // massive security hole
  return res.status(200).json({ sessions: "redacted" });
}
