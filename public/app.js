const state = {
  queries: [],
  selected: new Set(),
  selectedCategory: 'All',
  categories: [],
  bookmarks: new Set(),
  recent: [],
};

const elements = {
  filterInput: document.getElementById('filter-input'),
  queryList: document.getElementById('query-list'),
  categoryBar: document.getElementById('category-bar'),
  resultSummary: document.getElementById('result-summary'),
  totalCount: document.getElementById('total-count'),
  categoryCount: document.getElementById('category-count'),
  wordlistFile: document.getElementById('wordlist-file'),
  importButton: document.getElementById('import-button'),
  generateButton: document.getElementById('generate-button'),
  clearRecentButton: document.getElementById('clear-recent-button'),
  themeToggle: document.getElementById('theme-toggle'),
  addQueryButton: document.getElementById('add-query-button'),
  newQueryInput: document.getElementById('new-query-input'),
  saveButton: document.getElementById('save-button'),
  exportButton: document.getElementById('export-button'),
  recentList: document.getElementById('recent-list'),
  bookmarksList: document.getElementById('bookmarks-list'),
  bookmarkCount: document.getElementById('bookmark-count'),
};

function setTheme(mode) {
  document.body.dataset.theme = mode;
  elements.themeToggle.textContent = mode === 'dark' ? 'Light' : 'Dark';
  localStorage.setItem('dorkSearchTheme', mode);
}

function toggleTheme() {
  const current = document.body.dataset.theme || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function loadLocalState() {
  try {
    const storedBookmarks = JSON.parse(localStorage.getItem('dorkSearchBookmarks') || '[]');
    state.bookmarks = new Set(Array.isArray(storedBookmarks) ? storedBookmarks : []);
  } catch {
    state.bookmarks = new Set();
  }

  try {
    const storedRecent = JSON.parse(localStorage.getItem('dorkSearchRecents') || '[]');
    state.recent = Array.isArray(storedRecent) ? storedRecent : [];
  } catch {
    state.recent = [];
  }
}

function saveBookmarkState() {
  localStorage.setItem('dorkSearchBookmarks', JSON.stringify(Array.from(state.bookmarks)));
}

function saveRecentState() {
  localStorage.setItem('dorkSearchRecents', JSON.stringify(state.recent));
}

function addRecent(query) {
  const trimmed = query.trim();
  if (!trimmed) return;
  state.recent = state.recent.filter(item => item !== trimmed);
  state.recent.unshift(trimmed);
  if (state.recent.length > 12) {
    state.recent.length = 12;
  }
  saveRecentState();
  renderRecentList();
}

function clearRecentQueries() {
  state.recent = [];
  saveRecentState();
  renderRecentList();
}

function renderRecentList() {
  if (!elements.recentList) return;
  elements.recentList.innerHTML = '';
  if (state.recent.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-chip';
    empty.textContent = 'No recent queries yet';
    elements.recentList.appendChild(empty);
    if (elements.clearRecentButton) {
      elements.clearRecentButton.disabled = true;
    }
    return;
  }
  if (elements.clearRecentButton) {
    elements.clearRecentButton.disabled = false;
  }

  state.recent.forEach(query => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'history-chip';
    chip.textContent = query.length > 60 ? `${query.slice(0, 57)}...` : query;
    chip.title = query;
    chip.addEventListener('click', () => {
      elements.filterInput.value = query;
      renderQueries();
    });
    elements.recentList.appendChild(chip);
  });
}

function renderBookmarksPanel() {
  if (!elements.bookmarksList || !elements.bookmarkCount) return;
  elements.bookmarksList.innerHTML = '';
  const bookmarks = state.queries.filter(item => state.bookmarks.has(item.query));
  elements.bookmarkCount.textContent = bookmarks.length;

  if (bookmarks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-chip';
    empty.textContent = 'No bookmarks yet';
    elements.bookmarksList.appendChild(empty);
    return;
  }

  bookmarks.slice(0, 10).forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bookmark-chip';
    chip.textContent = item.query.length > 50 ? `${item.query.slice(0, 47)}...` : item.query;
    chip.title = item.query;
    chip.addEventListener('click', () => {
      elements.filterInput.value = item.query;
      renderQueries();
    });
    elements.bookmarksList.appendChild(chip);
  });
}

function toggleBookmark(item) {
  const query = item.query.trim();
  if (!query) return;
  if (state.bookmarks.has(query)) {
    state.bookmarks.delete(query);
  } else {
    state.bookmarks.add(query);
    addRecent(query);
  }

  saveBookmarkState();
  renderQueries();
  renderBookmarksPanel();
}

function updateBookmarkSummary() {
  if (!elements.bookmarkCount) return;
  elements.bookmarkCount.textContent = state.bookmarks.size;
}

function getQueryCategory(item) {
  return item.category || parseCategory(item.query);
}

function createQueryCard(item) {
  const card = document.createElement('div');
  card.className = 'query-card';

  const categoryLabel = document.createElement('div');
  categoryLabel.className = 'query-category';
  categoryLabel.textContent = getQueryCategory(item);

  const title = document.createElement('p');
  title.className = 'query-text';
  title.textContent = item.query;

  const controls = document.createElement('div');
  controls.className = 'query-actions';

  const selectButton = document.createElement('button');
  selectButton.textContent = state.selected.has(item.id) ? 'Deselect' : 'Select';
  selectButton.className = state.selected.has(item.id) ? 'selected' : '';
  selectButton.addEventListener('click', () => toggleSelection(item.id));

  const bookmarkButton = document.createElement('button');
  bookmarkButton.textContent = state.bookmarks.has(item.query) ? 'Bookmarked' : 'Bookmark';
  bookmarkButton.className = state.bookmarks.has(item.query) ? 'bookmarked' : '';
  bookmarkButton.addEventListener('click', () => toggleBookmark(item));

  const openButton = document.createElement('button');
  openButton.textContent = 'Google';
  openButton.addEventListener('click', () => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(item.query)}`, '_blank');
    addRecent(item.query);
  });

  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.addEventListener('click', () => {
    addRecent(item.query);
    copyText(item.query, copyButton);
  });

  const curlButton = document.createElement('button');
  curlButton.textContent = 'curl';
  curlButton.addEventListener('click', () => {
    const command = `curl -A "Mozilla/5.0" "https://www.google.com/search?q=${encodeURIComponent(item.query)}" -L -o "${sanitizeFileName(item.query)}.html"`;
    addRecent(item.query);
    copyText(command, curlButton);
  });

  controls.append(selectButton, bookmarkButton, openButton, copyButton, curlButton);
  card.append(categoryLabel, title, controls);
  return card;
}

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100);
}

function parseCategory(query) {
  const normalized = query.toLowerCase();

  if ((normalized.includes('cyber.gov.rw/home') || normalized.includes('cyber.gov.rw home') || normalized.includes('cyber.gov.rw/ home') || normalized.includes('https://cyber.gov.rw/home') || normalized.includes('site:cyber.gov.rw/home') || normalized.includes('inurl:cyber.gov.rw/home')) && normalized.includes('cyber.gov.rw')) {
    return 'cybergov_url';
  }

  if (normalized.includes('site:cyber.gov.rw') || normalized.includes('cyber.gov.rw') || normalized.includes('site:gov.rw') || normalized.includes('gov.rw')) {
    const targetMap = [
      { name: 'admin', patterns: ['admin', 'dashboard', 'control panel', 'portal', 'management', 'administrator', 'admin.php'] },
      { name: 'login', patterns: ['login', 'secure login', 'signin', 'sign in', 'auth', 'authentication', 'session', 'password reset'] },
      { name: 'vulnerability', patterns: ['phpinfo', 'debug', 'error', 'test.php', 'config.php', 'vulnerable', 'xss', 'sql', 'eval', 'shell', 'trace', 'stack trace', 'debug.log', 'indexof', 'console'] },
      { name: 'leaked', patterns: ['password', 'credential', 'secret', 'apikey', 'api_key', 'token', 'private key', 'ssh key', 'db_password', 'vault', 'secret key', 'connection string'] },
      { name: 'disclosure', patterns: ['filetype:sql', 'filetype:env', 'filetype:log', 'filetype:conf', 'filetype:xml', 'filetype:zip', 'filetype:bak', 'filetype:txt', 'inurl:.git', 'inurl:.svn', 'inurl:.hg', 'intitle:"index of"', 'inurl:"/backup/"', 'inurl:"/uploads/"', 'ext:sql', 'ext:env'] },
      { name: 'exposure', patterns: ['"confidential"', '"internal use only"', '"sensitive information"', '"private"', '"restricted"', '"not for public"'] },
    ];

    const matched = [];
    for (const target of targetMap) {
      if (target.patterns.some(pattern => normalized.includes(pattern))) {
        matched.push(target.name);
      }
    }

    if (matched.length > 1) {
      return `cybergov_combined:${matched.sort().join('+')}`;
    }
    if (matched.length === 1) {
      return `cybergov_${matched[0]}`;
    }
    return 'cybergov';
  }

  const targetMap = [
    { name: 'admin', patterns: ['admin', 'dashboard', 'control panel', 'portal', 'management'] },
    { name: 'login', patterns: ['login', 'secure login', 'signin', 'sign in', 'auth', 'authentication'] },
    { name: 'vulnerability', patterns: ['phpinfo', 'debug', 'error', 'test.php', 'config.php', 'vulnerable', 'xss', 'sql', 'eval', 'shell'] },
    { name: 'leaked', patterns: ['password', 'credential', 'secret', 'apikey', 'api_key', 'token', 'private key', 'ssh key'] },
    { name: 'disclosure', patterns: ['filetype:sql', 'filetype:env', 'filetype:log', 'filetype:conf', 'filetype:xml', 'filetype:zip', 'filetype:bak', 'inurl:.git', 'inurl:.svn', 'intitle:"index of"', 'inurl:"/backup/"', 'inurl:"/uploads/"'] },
    { name: 'exposure', patterns: ['"confidential"', '"internal use only"', '"sensitive information"', '"private"', '"restricted"'] },
  ];

  const matched = [];
  for (const target of targetMap) {
    if (target.patterns.some(pattern => normalized.includes(pattern))) {
      matched.push(target.name);
    }
  }

  if (matched.length > 1) {
    return `combined:${matched.sort().join('+')}`;
  }
  if (matched.length === 1) {
    return matched[0];
  }

  const countryMap = [
    { name: 'rwanda', patterns: ['site:.rw', 'site:rw', 'site:gov.rw', 'site:cyber.gov.rw'] },
    { name: 'uganda', patterns: ['site:.ug', 'site:ug'] },
    { name: 'kenya', patterns: ['site:.ke', 'site:ke'] },
    { name: 'burundi', patterns: ['site:.bi', 'site:bi'] },
    { name: 'congo', patterns: ['site:.cd', 'site:cd', 'site:.cg', 'site:cg'] },
    { name: 'tanzania', patterns: ['site:.tz', 'site:tz'] },
    { name: 'somalia', patterns: ['site:.so', 'site:so'] },
    { name: 'eritrea', patterns: ['site:.er', 'site:er'] },
    { name: 'djibouti', patterns: ['site:.dj', 'site:dj'] },
  ];

  for (const country of countryMap) {
    if (country.patterns.some(pattern => normalized.includes(pattern))) {
      return country.name;
    }
  }

  const match = query.trim().match(/^([a-zA-Z0-9_]+):/);
  if (match) {
    return match[1].toLowerCase();
  }

  if (/^"/.test(query.trim())) {
    return 'phrase';
  }

  return 'other';
}

function buildCategories() {
  const counts = {};
  state.queries.forEach(item => {
    const category = getQueryCategory(item);
    counts[category] = (counts[category] || 0) + 1;
  });

  const ordered = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const categories = ordered.map(name => ({ name, count: counts[name] }));
  const total = state.queries.length;
  state.categories = [{ name: 'All', count: total }, ...categories];
}

function renderCategoryBar() {
  elements.categoryBar.innerHTML = '';
  state.categories.forEach(({ name, count }) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip' + (state.selectedCategory === name ? ' active' : '');
    chip.textContent = name === 'All' ? `All (${count})` : `${name} (${count})`;
    chip.addEventListener('click', () => {
      state.selectedCategory = name;
      renderCategoryBar();
      renderQueries();
    });
    elements.categoryBar.appendChild(chip);
  });
}

function renderStats() {
  elements.totalCount.textContent = state.queries.length;
  elements.categoryCount.textContent = state.categories.length - 1;
  updateBookmarkSummary();
}

function renderSummary(filtered) {
  const categoryLabel = state.selectedCategory === 'All' ? '' : ` · ${state.selectedCategory}`;
  elements.resultSummary.textContent = `${filtered.length} results${categoryLabel} · ${state.selected.size} selected`;
}

function renderQueries() {
  const filter = elements.filterInput.value.trim().toLowerCase();
  elements.queryList.innerHTML = '';

  const filtered = state.queries.filter(item => {
    const matchesFilter = item.query.toLowerCase().includes(filter);
    const category = parseCategory(item.query);
    const matchesCategory = state.selectedCategory === 'All' || category === state.selectedCategory;
    return matchesFilter && matchesCategory;
  });

  renderSummary(filtered);

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No matching queries. Try a different search or add a new one.';
    elements.queryList.appendChild(empty);
    return;
  }

  filtered.forEach(item => elements.queryList.appendChild(createQueryCard(item)));
}

function toggleSelection(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  renderQueries();
}

function copyText(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = original;
    }, 1000);
  }).catch(() => {
    console.error('Clipboard write failed');
  });
}

function addQuery() {
  const value = elements.newQueryInput.value.trim();
  if (!value) {
    return;
  }
  const nextId = state.queries.length ? Math.max(...state.queries.map(item => item.id)) + 1 : 1;
  state.queries.push({ id: nextId, query: value });
  elements.newQueryInput.value = '';
  buildCategories();
  renderCategoryBar();
  renderStats();
  renderQueries();
}

async function importWordlist() {
  const file = elements.wordlistFile.files[0];
  if (!file) {
    window.alert('Select a .txt wordlist file to import.');
    return;
  }

  const text = await file.text();
  const response = await fetch('/api/import-wordlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  const result = await response.json();
  if (!response.ok) {
    window.alert(`Import failed: ${result.error || 'Unknown error'}`);
    return;
  }

  await loadQueries();
  window.alert(`Imported ${result.added} new queries. Total is now ${result.total}.`);
}

async function saveQueries() {
  const payload = { queries: state.queries };
  const response = await fetch('/api/save-queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (response.ok) {
    window.alert(`Saved ${result.count} queries.`);
  } else {
    window.alert(`Save failed: ${result.error}`);
  }
}

async function generateCyberDorks() {
  const response = await fetch('/api/generate-cyber-dorks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const result = await response.json();
  if (!response.ok) {
    window.alert(`Generation failed: ${result.error || 'Unknown error'}`);
    return;
  }

  await loadQueries();
  window.alert(`Generated ${result.generated} cyber.gov.rw dorks and added ${result.added} new queries.`);
}

async function exportReport() {
  const items = state.queries.filter(item => state.selected.has(item.id)).map(item => ({
    query: item.query,
    note: '',
  }));

  if (items.length === 0) {
    window.alert('Select at least one query before exporting a report.');
    return;
  }

  const response = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dork-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadQueries() {
  loadLocalState();
  const response = await fetch('/api/queries');
  const data = await response.json();
  state.queries = data.queries;
  buildCategories();
  renderCategoryBar();
  renderStats();
  renderRecentList();
  renderBookmarksPanel();
  renderQueries();
}

elements.filterInput.addEventListener('input', renderQueries);
elements.addQueryButton.addEventListener('click', addQuery);
elements.importButton.addEventListener('click', importWordlist);
elements.generateButton.addEventListener('click', generateCyberDorks);
elements.clearRecentButton?.addEventListener('click', clearRecentQueries);
elements.saveButton.addEventListener('click', saveQueries);
elements.exportButton.addEventListener('click', exportReport);
elements.themeToggle.addEventListener('click', toggleTheme);

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('dorkSearchTheme') || 'dark';
  setTheme(savedTheme);
  loadQueries();
});
