const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const queriesPath = path.join(__dirname, 'google-dorks search query.txt');
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '2015',
  port: Number(process.env.DB_PORT || 3306),
  multipleStatements: true,
};
const dbName = process.env.DB_NAME || 'dork_manager';
const tableName = 'queries';

function hashQuery(query) {
  return crypto.createHash('sha256').update(query).digest('hex');
}

function parseCategory(query) {
  const normalized = String(query).toLowerCase();
  if (normalized.includes('admin') || normalized.includes('dashboard') || normalized.includes('portal')) {
    return 'admin';
  }
  if (normalized.includes('login') || normalized.includes('signin') || normalized.includes('auth')) {
    return 'login';
  }
  if (normalized.includes('filetype:') || normalized.includes('inurl:.git') || normalized.includes('inurl:.svn') || normalized.includes('intitle:"index of"')) {
    return 'disclosure';
  }
  if (normalized.includes('password') || normalized.includes('secret') || normalized.includes('apikey') || normalized.includes('token')) {
    return 'leaked';
  }
  if (normalized.includes('phpinfo') || normalized.includes('debug') || normalized.includes('error') || normalized.includes('vulnerable') || normalized.includes('xss') || normalized.includes('sql')) {
    return 'vulnerability';
  }
  return 'other';
}

async function getDbConnection() {
  const connection = await mysql.createConnection(dbConfig);
  const initSql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${dbName}\`; CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n    id INT PRIMARY KEY AUTO_INCREMENT,\n    query TEXT NOT NULL,\n    query_hash CHAR(64) NOT NULL,\n    category VARCHAR(80) NOT NULL DEFAULT 'other',\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n    UNIQUE KEY uq_query_hash (query_hash)\n  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await connection.query(initSql);
  return connection;
}

async function readQueriesFromFile() {
  const raw = await fs.readFile(queriesPath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

async function importQueries() {
  const queries = await readQueriesFromFile();
  if (queries.length === 0) {
    console.log('No queries found in the source file.');
    return;
  }

  const connection = await getDbConnection();
  const uniqueQueries = Array.from(new Set(queries));
  const rows = uniqueQueries.map(query => [query, hashQuery(query), parseCategory(query)]);
  const chunkSize = 500;

  await connection.query(`TRUNCATE TABLE \`${tableName}\`;`);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?, ?)').join(',');
    const values = chunk.flat();
    const sql = `INSERT INTO \`${tableName}\` (query, query_hash, category) VALUES ${placeholders};`;
    await connection.query(sql, values);
  }

  console.log(`Imported ${uniqueQueries.length} unique queries into database '${dbName}'.`);
  await connection.end();
}

(async function main() {
  try {
    await importQueries();
    console.log('Database setup and query import complete.');
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exit(1);
  }
})();
