import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback for Railway

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/trivia',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: '60m',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  telephony: {
    provider: process.env.TELEPHONY_PROVIDER || 'twilio',
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000',
    dtmfTimeout: 30,
    maxRetries: 3,
  },

  security: {
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    sessionTimeoutMinutes: 60,
  },

  sounds: {
    confirm: '/sounds/confirm.mp3',
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/wrong.mp3',
  },
};
