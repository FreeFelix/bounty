# Google Dork Manager

A lightweight local UI for managing Google dork queries, copying CLI command templates, and generating evidence reports.

## Features

- Browse and filter your dork list from `google-dorks search query.txt`
- Add new queries directly from the interface
- Select queries for a report or evidence workflow
- Copy query text and `curl` command templates quickly
- Export a Markdown report with selected queries and notes
- Save changes back to the original query file
- Generate targeted `cyber.gov.rw` Google dorks for bug, vulnerability, and leak discovery categories

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd bounty
```

2. Install dependencies:

```bash
npm install
```

3. Create or configure the MySQL database:

```bash
# Set DB credentials as needed
export DB_HOST=127.0.0.1
export DB_USER=root
export DB_PASSWORD=2015
export DB_PORT=3306
export DB_NAME=dork_manager
```

4. Initialize the database and import all queries from `google-dorks search query.txt`:

```bash
npm run db:setup
```

5. Run the application:

```bash
npm start
```

6. Open the UI in your browser:

```bash
http://localhost:3000
```

7. Optional: generate `.gov.rw` and `cyber.gov.rw` dorks from the UI by clicking `Generate .gov.rw dorks`, or import additional query lists via the import form.

## How to use

- Use the filter box to search inside query text.
- Click `Select` to include queries in the report panel.
- Add notes to capture evidence context.
- Click `Save queries` to persist changes to the source query file.
- Click `Export report` to download a Markdown report.
- Click `Generate .gov.rw dorks` to build categorized dorks for Rwanda `.gov.rw` sites and `cyber.gov.rw` discovery categories.
- Use `Import wordlist` to add another `.txt` query list directly from the UI.

## Notes

- CLI command templates are provided for `curl` searches.
- The app does not perform automated vulnerability discovery; it helps manage and document search queries safely.
