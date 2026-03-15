const { Client } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const USERNAME = 'admin';
const PASSWORD = 'admin123';

async function createUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const hash = await bcrypt.hash(PASSWORD, 12);
    await client.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [USERNAME, hash]
    );
    console.log(`User created: ${USERNAME} / ${PASSWORD}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

createUser();
