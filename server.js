const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
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
let dbConnection;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function hashQuery(query) {
  return crypto.createHash('sha256').update(query).digest('hex');
}

async function getDbConnection() {
  if (dbConnection) return dbConnection;
  dbConnection = await mysql.createConnection(dbConfig);
  const initSql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${dbName}\`; CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n    id INT PRIMARY KEY AUTO_INCREMENT,\n    query TEXT NOT NULL,\n    query_hash CHAR(64) NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n    UNIQUE KEY uq_query_hash (query_hash)\n  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await dbConnection.query(initSql);
  return dbConnection;
}

async function readQueriesFromFile() {
  const raw = await fs.readFile(queriesPath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

function normalizeQueries(text) {
  return String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

async function appendUniqueQueries(newQueries) {
  const existing = new Set(await readQueriesFromFile());
  const unique = [];

  for (const query of normalizeQueries(newQueries)) {
    if (!existing.has(query)) {
      existing.add(query);
      unique.push(query);
    }
  }

  if (unique.length > 0) {
    await fs.appendFile(queriesPath, unique.join('\n') + '\n', 'utf8');
    await syncFileToDatabase();
  }

  return { total: existing.size, added: unique.length };
}

async function syncFileToDatabase() {
  const queries = await readQueriesFromFile();
  if (queries.length === 0) return;

  const conn = await getDbConnection();
  const uniqueQueries = Array.from(new Set(queries));
  await conn.query(`TRUNCATE TABLE \`${tableName}\`;`);

  const rows = uniqueQueries.map(query => [query, hashQuery(query)]);
  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?)').join(',');
    const values = chunk.flat();
    const sql = `INSERT INTO \`${tableName}\` (query, query_hash) VALUES ${placeholders};`;
    await conn.query(sql, values);
  }
}

async function readQueries() {
  try {
    const conn = await getDbConnection();
    await syncFileToDatabase();
    const [rows] = await conn.query(`SELECT id, query FROM \`${tableName}\` ORDER BY id ASC;`);
    return rows.map(row => ({ id: row.id, query: row.query }));
  } catch (error) {
    console.error('Database unavailable, falling back to file storage.', error.message);
    const fileQueries = await readQueriesFromFile();
    return fileQueries.map((query, index) => ({ id: index + 1, query }));
  }
}

async function writeQueries(queries) {
  const body = queries.map(item => item.query.trim()).filter(Boolean).join('\n') + '\n';
  await fs.writeFile(queriesPath, body, 'utf8');
  try {
    await syncFileToDatabase();
  } catch (error) {
    console.error('Unable to sync saved queries to database.', error.message);
  }
}

app.get('/api/queries', async (req, res) => {
  try {
    const queries = await readQueries();
    res.json({ queries });
  } catch (error) {
    res.status(500).json({ error: 'Unable to read queries.' });
  }
});

app.post('/api/save-queries', async (req, res) => {
  try {
    const queries = Array.isArray(req.body.queries) ? req.body.queries : [];
    await writeQueries(queries);
    res.json({ success: true, count: queries.length });
  } catch (error) {
    res.status(500).json({ error: 'Unable to save queries.' });
  }
});

app.post('/api/import-wordlist', async (req, res) => {
  try {
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    if (!content.trim()) {
      return res.status(400).json({ error: 'No wordlist content provided.' });
    }

    const result = await appendUniqueQueries(content);
    res.json({ success: true, added: result.added, total: result.total });
  } catch (error) {
    console.error('Import error:', error.message);
    res.status(500).json({ error: 'Unable to import wordlist.' });
  }
});

app.post('/api/report', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No report items provided.' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const title = `dork-report-${timestamp}.md`;
    let content = `# Dork Search Report\n`;
    content += `Generated: ${new Date().toISOString()}\n\n`;
    content += `## Summary\n`;
    content += `- Total queries: ${items.length}\n\n`;

    items.forEach((item, index) => {
      content += `### ${index + 1}. ${item.query}\n\n`;
      if (item.note) {
        content += `**Note:** ${item.note.replace(/\r?\n/g, ' ')}\n\n`;
      }
      content += `**Google search:** [Open search](https://www.google.com/search?q=${encodeURIComponent(item.query)})\n\n`;
      content += `**CLI command:**\n`;
      content += '```bash\n';
      content += `curl -A "Mozilla/5.0" "https://www.google.com/search?q=${encodeURIComponent(item.query)}" -L -o "${item.query.replace(/[^a-zA-Z0-9_-]/g, '_')}.html"\n`;
      content += '```\n\n';
    });

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${title}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: 'Unable to create report.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  try {
    await getDbConnection();
    await syncFileToDatabase();
    console.log(`Google dorks UI server running at http://localhost:${port}`);
  } catch (error) {
    console.warn('Server started but unable to initialize MySQL storage:', error.message);
    console.log(`Google dorks UI server running at http://localhost:${port}`);
  }
});
