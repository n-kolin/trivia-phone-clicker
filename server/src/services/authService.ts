import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/db';
import { config } from '../config';
import { User } from '@trivia/shared';

export async function registerUser(username: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

  const result = await query(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, password_hash, created_at, last_login_at`,
    [username, passwordHash]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function loginUser(
  username: string,
  password: string,
  ipAddress: string
): Promise<string> {
  // Check IP block before attempting login
  const blocked = await isIpBlocked(ipAddress);
  if (blocked) {
    throw new Error('IP_BLOCKED');
  }

  // Fetch user
  const userResult = await query(
    `SELECT id, username, password_hash FROM users WHERE username = $1`,
    [username]
  );

  const user = userResult.rows[0];
  const isValid = user ? await bcrypt.compare(password, user.password_hash) : false;

  // Record the attempt
  await query(
    `INSERT INTO login_attempts (ip_address, success) VALUES ($1, $2)`,
    [ipAddress, isValid]
  );

  if (!isValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Update last login
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [user.id]
  );

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );

  return token;
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; username: string } | null> {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string; username: string };
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export function isSessionValid(lastActivity: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - lastActivity.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes < config.security.sessionTimeoutMinutes;
}

export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const windowMinutes = config.security.lockoutDurationMinutes;
  const maxAttempts = config.security.maxLoginAttempts;

  // Get recent attempts in the last 15 minutes, ordered by time
  const result = await query(
    `SELECT success FROM login_attempts
     WHERE ip_address = $1
       AND attempt_at > NOW() - INTERVAL '${windowMinutes} minutes'
     ORDER BY attempt_at DESC`,
    [ipAddress]
  );

  const attempts = result.rows;

  // Count consecutive failed attempts from the most recent
  let consecutiveFails = 0;
  for (const attempt of attempts) {
    if (!attempt.success) {
      consecutiveFails++;
    } else {
      break; // A successful login resets the streak
    }
  }

  return consecutiveFails >= maxAttempts;
}
