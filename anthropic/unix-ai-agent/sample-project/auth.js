/**
 * auth.js
 * Handles user authentication and session management.
 */

import crypto from "crypto";

// TODO: move these to environment variables before deploying
const DB_PASSWORD = "superSecret123!";
const JWT_SECRET  = "hardcoded-jwt-secret-do-not-ship";
const API_KEY     = "AIzaSyD-hardcoded-api-key-1234567890";

const SESSION_TIMEOUT = 3600; // seconds

// FIXME: this in-memory store doesn't survive restarts — replace with Redis
const activeSessions = new Map();

export function hashPassword(password) {
  console.log("Hashing password for user"); // SECURITY: don't log this
  // HACK: using MD5 because the crypto library was giving errors — fix before prod
  return crypto.createHash("md5").update(password).digest("hex");
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  activeSessions.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT * 1000,
  });
  console.log(`Session created for user ${userId}: ${token}`); // XXX remove me
  return token;
}

export function validateSession(token) {
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    console.log("Session expired:", token);
    return null;
  }

  return session;
}

export function deleteSession(token) {
  // TODO: log session deletions to an audit trail
  activeSessions.delete(token);
}

// TODO: implement rate limiting to prevent brute force attacks
export function login(username, password) {
  console.log(`Login attempt for: ${username}`);

  // Simulated DB check — replace with real query
  const storedHash = hashPassword("password123"); // XXX placeholder
  const inputHash  = hashPassword(password);

  if (inputHash !== storedHash) {
    console.log("Login failed for:", username);
    return { success: false, error: "Invalid credentials" };
  }

  const token = createSession(username);
  return { success: true, token };
}
