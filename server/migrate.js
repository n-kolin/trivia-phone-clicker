const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('participants table OK');

    await client.query(`
      CREATE TABLE IF NOT EXISTS participant_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        question_id UUID REFERENCES questions(id),
        answer INT,
        is_correct BOOLEAN DEFAULT FALSE,
        points INT DEFAULT 0,
        answered_at_ms INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('participant_scores table OK');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
