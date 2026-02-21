# Free Judgesystem

A minimal Next.js 15 application with a JSON-file persistence layer for event data.

## Features

- **Next.js 15** with the App Router and React 19
- **REST API** — `GET` / `POST` at `/api/event`
- **Atomic file persistence** — events are saved via temp-file-then-rename to prevent corruption
- **TypeScript** with runtime type guards

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

### Production

```sh
npm run build
npm start
```

## API

### `GET /api/event`

Returns the stored event or `404` if none exists.

### `POST /api/event`

Creates/replaces the stored event. Body (JSON):

```json
{
  "id": "evt-1",
  "name": "My Event",
  "createdAt": "2026-02-21T00:00:00.000Z"
}
```

Returns `201` on success, `400` on validation failure.

## Project Structure

```
app/
  layout.tsx          – Root layout
  page.tsx            – Home page
  api/event/route.ts  – Event API endpoint
lib/
  store.ts            – File-based persistence (atomic writes)
  types.ts            – EventData interface & type guard
data/                 – Runtime storage (gitignored)
```

## License

Private
