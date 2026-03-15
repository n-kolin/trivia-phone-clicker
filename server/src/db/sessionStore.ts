import Redis from 'ioredis';
import { SessionRecord } from '@trivia/shared';
import { config } from '../config';

export const redis = new Redis(config.redisUrl);

export const SESSION_PREFIX = 'session:';
export const SESSION_TTL = 86400; // 24 hours in seconds

function sessionKey(callSid: string): string {
  return `${SESSION_PREFIX}${callSid}`;
}

export async function createSession(record: SessionRecord): Promise<void> {
  await redis.set(sessionKey(record.callSid), JSON.stringify(record), 'EX', SESSION_TTL);
}

export async function getSession(callSid: string): Promise<SessionRecord | null> {
  const data = await redis.get(sessionKey(callSid));
  if (!data) return null;
  return JSON.parse(data) as SessionRecord;
}

export async function updateSession(callSid: string, updates: Partial<SessionRecord>): Promise<void> {
  const existing = await getSession(callSid);
  if (!existing) return;
  const updated = { ...existing, ...updates };
  const ttl = await redis.ttl(sessionKey(callSid));
  await redis.set(sessionKey(callSid), JSON.stringify(updated), 'EX', ttl > 0 ? ttl : SESSION_TTL);
}

export async function deleteSession(callSid: string): Promise<void> {
  await redis.del(sessionKey(callSid));
}

export async function getActiveSessionCount(): Promise<number> {
  const sessions = await getAllActiveSessions();
  return sessions.length;
}

export async function getAllActiveSessions(): Promise<SessionRecord[]> {
  const keys = await redis.keys(`${SESSION_PREFIX}*`);
  if (keys.length === 0) return [];

  const values = await redis.mget(...keys);
  const sessions: SessionRecord[] = [];

  for (const val of values) {
    if (!val) continue;
    const session = JSON.parse(val) as SessionRecord;
    if (session.status === 'active') {
      sessions.push(session);
    }
  }

  return sessions;
}

export async function closeAllSessions(): Promise<void> {
  const sessions = await getAllActiveSessions();
  await Promise.all(
    sessions.map((s) => updateSession(s.callSid, { status: 'inactive' }))
  );
}
