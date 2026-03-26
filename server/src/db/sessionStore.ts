import { SessionRecord } from '../types';

// In-memory session store - no Redis needed for phone sessions
const sessions = new Map<string, SessionRecord>();

export const SESSION_PREFIX = 'session:';

export async function createSession(record: SessionRecord): Promise<void> {
  sessions.set(record.callSid, record);
}

export async function getSession(callSid: string): Promise<SessionRecord | null> {
  return sessions.get(callSid) ?? null;
}

export async function updateSession(callSid: string, updates: Partial<SessionRecord>): Promise<void> {
  const existing = sessions.get(callSid);
  if (!existing) return;
  sessions.set(callSid, { ...existing, ...updates });
}

export async function deleteSession(callSid: string): Promise<void> {
  sessions.delete(callSid);
}

export async function getActiveSessionCount(): Promise<number> {
  let count = 0;
  for (const s of sessions.values()) {
    if (s.status === 'active') count++;
  }
  return count;
}

export async function getAllActiveSessions(): Promise<SessionRecord[]> {
  const result: SessionRecord[] = [];
  for (const s of sessions.values()) {
    if (s.status === 'active') result.push(s);
  }
  return result;
}

export async function closeAllSessions(): Promise<void> {
  for (const [key, s] of sessions.entries()) {
    sessions.set(key, { ...s, status: 'inactive' });
  }
}

// Dummy redis export for any code that still imports it
export const redis = {
  get: async () => null,
  set: async () => null,
  del: async () => null,
  keys: async () => [],
  mget: async () => [],
  on: () => {},
};
