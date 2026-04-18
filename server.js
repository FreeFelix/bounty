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
const cyberSite = 'site:cyber.gov.rw';
let dbConnection;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function hashQuery(query) {
  return crypto.createHash('sha256').update(query).digest('hex');
}

function parseQueryCategory(query) {
  const normalized = String(query).toLowerCase();
  if (normalized.includes('cyber.gov.rw/home') || normalized.includes('cyber.gov.rw home') || normalized.includes('cyber.gov.rw/ home') || normalized.includes('site:gov.rw/home') || normalized.includes('gov.rw/home')) {
    return 'cybergov_home';
  }
  if (normalized.includes('site:cyber.gov.rw') || normalized.includes('cyber.gov.rw') || normalized.includes('site:gov.rw') || normalized.includes('gov.rw')) {
    const matched = [];
    if (normalized.includes('admin') || normalized.includes('dashboard') || normalized.includes('portal') || normalized.includes('control panel')) {
      matched.push('admin');
    }
    if (normalized.includes('login') || normalized.includes('signin') || normalized.includes('sign in') || normalized.includes('auth') || normalized.includes('authentication')) {
      matched.push('login');
    }
    if (normalized.includes('filetype:') || normalized.includes('ext:') || normalized.includes('backup') || normalized.includes('db_') || normalized.includes('dump') || normalized.includes('log') || normalized.includes('env') || normalized.includes('git') || normalized.includes('svn')) {
      matched.push('disclosure');
    }
    if (normalized.includes('password') || normalized.includes('secret') || normalized.includes('credential') || normalized.includes('apikey') || normalized.includes('api_key') || normalized.includes('token') || normalized.includes('private key') || normalized.includes('ssh key')) {
      matched.push('leaked');
    }
    if (normalized.includes('phpinfo') || normalized.includes('debug') || normalized.includes('error') || normalized.includes('test.php') || normalized.includes('config.php') || normalized.includes('vulnerable') || normalized.includes('xss') || normalized.includes('sql') || normalized.includes('eval') || normalized.includes('shell')) {
      matched.push('vulnerability');
    }
    if (matched.length > 1) {
      return `cybergov_combined:${matched.sort().join('+')}`;
    }
    if (matched.length === 1) {
      return `cybergov_${matched[0]}`;
    }
    return 'cybergov';
  }
  if (/^"/.test(String(query).trim())) {
    return 'phrase';
  }
  if (/^[a-zA-Z0-9_]+:/.test(String(query).trim())) {
    return String(query).trim().split(':')[0].toLowerCase();
  }
  return 'other';
}

function buildCyberGovDorks() {
  const sites = ['site:cyber.gov.rw', 'site:gov.rw'];
  const patterns = {
    admin: ['admin', 'dashboard', 'control panel', 'portal', 'management', 'administrator', 'admin.php', 'admin area'],
    login: ['login', 'signin', 'sign in', 'auth', 'authentication', 'user login', 'session', 'password reset'],
    vulnerability: ['phpinfo', 'debug', 'error', 'test.php', 'config.php', 'vulnerable', 'xss', 'sql', 'eval', 'shell', 'trace', 'stack trace', 'debug.log', 'indexof', 'console'],
    leaked: ['password', 'credential', 'secret', 'apikey', 'api_key', 'token', 'private key', 'ssh key', 'db_password', 'vault', 'secret key', 'connection string'],
    disclosure: ['filetype:sql', 'filetype:env', 'filetype:log', 'filetype:conf', 'filetype:xml', 'filetype:zip', 'filetype:bak', 'filetype:txt', 'inurl:.git', 'inurl:.svn', 'inurl:.hg', 'intitle:"index of"', 'inurl:"/backup/"', 'inurl:"/uploads/"', 'ext:sql', 'ext:env'],
    exposure: ['"confidential"', '"internal use only"', '"sensitive information"', '"private"', '"restricted"', '"not for public"'],
  };

  const queries = [];

  function shouldUseInurl(pattern) {
    return !pattern.startsWith('filetype:') && !pattern.startsWith('intitle:') && !pattern.startsWith('inurl:') && !pattern.startsWith('"');
  }

  for (const site of sites) {
    for (const [category, values] of Object.entries(patterns)) {
      for (const pattern of values) {
        queries.push({
          query: `${site} ${pattern}`.trim(),
          category: `cybergov_${category}`,
        });
        if (shouldUseInurl(pattern)) {
          queries.push({
            query: `${site} inurl:${pattern}`.trim(),
            category: `cybergov_${category}`,
          });
        }
      }
    }

    if (site === 'site:cyber.gov.rw') {
      const homeKeywords = ['home', 'login', 'admin', 'dashboard', 'portal', 'config.php', 'phpinfo', 'error', 'password', 'apikey', 'token', 'intitle:"index of"', 'filetype:php', 'confidential', 'secret', 'credentials', 'sessionid', 'csrf', 'cookie', 'sso', 'oauth'];
      const urlQueries = [
        `${site}/home`,
        `https://cyber.gov.rw/home/`,
        `inurl:cyber.gov.rw/home`,
        `${site} inurl:home`,
      ];

      for (const urlQuery of urlQueries) {
        queries.push({ query: urlQuery.trim(), category: 'cybergov_url' });
      }

      for (const keyword of homeKeywords) {
        queries.push({
          query: `${site}/home ${keyword}`.trim(),
          category: 'cybergov_url',
        });
        if (shouldUseInurl(keyword)) {
          queries.push({
            query: `${site}/home inurl:${keyword}`.trim(),
            category: 'cybergov_url',
          });
        }
      }

      const homeCombos = [
        ['admin', 'vulnerability'],
        ['admin', 'disclosure'],
        ['admin', 'leaked'],
        ['login', 'leaked'],
        ['login', 'vulnerability'],
        ['login', 'disclosure'],
        ['disclosure', 'leaked'],
        ['vulnerability', 'leaked'],
        ['leaked', 'exposure'],
      ];

      for (const [first, second] of homeCombos) {
        const firstValues = patterns[first] || [];
        const secondValues = patterns[second] || [];
        for (const termA of firstValues) {
          for (const termB of secondValues) {
            const combinedCategory = `cybergov_combined:${first}+${second}`;
            queries.push({
              query: `${site}/home ${termA} ${termB}`.trim(),
              category: combinedCategory,
            });
            if (shouldUseInurl(termA)) {
              queries.push({
                query: `${site}/home inurl:${termA} ${termB}`.trim(),
                category: combinedCategory,
              });
            }
            if (shouldUseInurl(termB)) {
              queries.push({
                query: `${site}/home ${termA} inurl:${termB}`.trim(),
                category: combinedCategory,
              });
            }
          }
        }
      }
    }

    const comboPairs = [
      ['admin', 'login'],
      ['admin', 'vulnerability'],
      ['admin', 'disclosure'],
      ['login', 'leaked'],
      ['login', 'vulnerability'],
      ['disclosure', 'leaked'],
      ['disclosure', 'exposure'],
      ['vulnerability', 'leaked'],
    ];

    for (const [first, second] of comboPairs) {
      const firstValues = patterns[first] || [];
      const secondValues = patterns[second] || [];
      for (const termA of firstValues) {
        for (const termB of secondValues) {
          const combinedCategory = `cybergov_combined:${first}+${second}`;
          queries.push({
            query: `${site} ${termA} ${termB}`.trim(),
            category: combinedCategory,
          });
          if (shouldUseInurl(termA)) {
            queries.push({
              query: `${site} inurl:${termA} ${termB}`.trim(),
              category: combinedCategory,
            });
          }
          if (shouldUseInurl(termB)) {
            queries.push({
              query: `${site} ${termA} inurl:${termB}`.trim(),
              category: combinedCategory,
            });
          }
        }
      }
    }
  }

  const unique = new Map();
  for (const item of queries) {
    unique.set(item.query, item);
  }
  return Array.from(unique.values());
}

async function getDbConnection() {
  if (dbConnection) return dbConnection;
  dbConnection = await mysql.createConnection(dbConfig);
  const initSql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${dbName}\`; CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n    id INT PRIMARY KEY AUTO_INCREMENT,\n    query TEXT NOT NULL,\n    query_hash CHAR(64) NOT NULL,\n    category VARCHAR(80) NOT NULL DEFAULT 'other',\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n    UNIQUE KEY uq_query_hash (query_hash)\n  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
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

  const rows = uniqueQueries.map(query => [query, hashQuery(query), parseQueryCategory(query)]);
  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?, ?)').join(',');
    const values = chunk.flat();
    const sql = `INSERT INTO \`${tableName}\` (query, query_hash, category) VALUES ${placeholders};`;
    await conn.query(sql, values);
  }
}

async function readQueries() {
  try {
    const conn = await getDbConnection();
    await syncFileToDatabase();
    const [rows] = await conn.query(`SELECT id, query, category FROM \`${tableName}\` ORDER BY id ASC;`);
    return rows.map(row => ({ id: row.id, query: row.query, category: row.category || parseQueryCategory(row.query) }));
  } catch (error) {
    console.error('Database unavailable, falling back to file storage.', error.message);
    const fileQueries = await readQueriesFromFile();
    return fileQueries.map((query, index) => ({ id: index + 1, query, category: parseQueryCategory(query) }));
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

app.post('/api/generate-cyber-dorks', async (req, res) => {
  try {
    const generated = buildCyberGovDorks();
    const existing = new Set(await readQueriesFromFile());
    const uniqueToAdd = generated.filter(item => !existing.has(item.query));

    if (uniqueToAdd.length > 0) {
      await fs.appendFile(queriesPath, uniqueToAdd.map(item => item.query).join('\n') + '\n', 'utf8');
      await syncFileToDatabase();
    }

    res.json({
      success: true,
      generated: generated.length,
      added: uniqueToAdd.length,
      total: existing.size + uniqueToAdd.length,
      newQueries: uniqueToAdd.map(item => ({ query: item.query, category: item.category })),
    });
  } catch (error) {
    console.error('Generation error:', error.message);
    res.status(500).json({ error: 'Unable to generate cyber.gov.rw dorks.' });
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
