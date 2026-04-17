# Google Dork Manager

A lightweight local UI for managing Google dork queries, copying CLI command templates, and generating evidence reports.

## Features

- Browse and filter your dork list from `google-dorks search query.txt`
- Add new queries directly from the interface
- Select queries for a report or evidence workflow
- Copy query text and `curl` command templates quickly
- Export a Markdown report with selected queries and notes
- Save changes back to the original query file

## Setup

1. Install dependencies:

```bash
npm install
```

2. Initialize the MySQL database and import all queries:

```bash
npm run db:setup
```

3. Start the app:

```bash
npm start
```

4. Open the UI in your browser:

```bash
http://localhost:3000
```

## How to use

- Use the filter box to search inside query text.
- Click `Select` to include queries in the report panel.
- Add notes to capture evidence context.
- Click `Save queries` to persist changes to the source query file.
- Click `Export report` to download a Markdown report.
- Use `Import wordlist` to add another `.txt` query list directly from the UI.

## Notes

- CLI command templates are provided for `curl` searches.
- The app does not perform automated vulnerability discovery; it helps manage and document search queries safely.
