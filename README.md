# Fingerprint Library

A research-grade browser fingerprinting library with 25+ modules, including lie detection, headless browser detection, and a server component for fingerprint storage and comparison.

## Features

- **25+ Fingerprinting Modules**: Canvas, WebGL, Audio, Navigator, Screen, Fonts, Timezone, and more
- **Detection Modules**: Headless browser detection, API spoofing detection, privacy tool detection
- **Fuzzy Matching**: 64-character fuzzy hash for similarity matching
- **Server Component**: Express API with PostgreSQL for storage and visitor identification
- **Demo Application**: Next.js demo with real-time fingerprint visualization

## Project Structure

```
fingerprint/
├── packages/
│   ├── client/           # TypeScript fingerprinting library
│   └── server/           # Express API server
├── demo/                 # Next.js demo application
└── creepjs/              # CreepJS reference (cloned)
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL (for server)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Client Library Usage

```typescript
import { Fingerprint } from '@anthropic/fingerprint-client';

const fp = new Fingerprint({
  modules: 'all',  // or: ['canvas', 'webgl', 'audio', ...]
});

const result = await fp.collect();
// {
//   fingerprint: "a1b2c3d4...",     // Combined SHA-256 hash
//   fuzzyHash: "x9y8z7...",         // 64-char fuzzy hash
//   components: { ... },            // Individual module results
//   detection: { ... },             // Detection results
//   entropy: 42.5                   // bits
// }

// Send to server for visitor identification
const visitor = await fp.identify('http://localhost:3001/api/fingerprint');
// { visitorId: "abc123", confidence: 0.98, matchType: "exact" }
```

### Running the Demo

1. **Start the server** (requires PostgreSQL):

```bash
# Copy environment file
cp packages/server/.env.example packages/server/.env

# Edit .env with your database credentials
# Then run migrations
pnpm --filter @anthropic/fingerprint-server db:push

# Start server
pnpm dev:server
```

2. **Start the demo**:

```bash
pnpm dev:demo
```

3. Open http://localhost:3000

## Modules

### Core Modules (High Entropy)
| Module | Description |
|--------|-------------|
| `canvas` | 2D canvas rendering fingerprint |
| `webgl` | WebGL parameters and rendering |
| `audio` | Web Audio API fingerprint |
| `navigator` | Browser and system info |
| `screen` | Display information |
| `fonts` | Available system fonts |
| `timezone` | Timezone and locale |

### Extended Modules
| Module | Description |
|--------|-------------|
| `math` | Floating-point precision |
| `domrect` | DOM measurements |
| `intl` | Internationalization API |
| `webrtc` | WebRTC capabilities |
| `svg` | SVG text metrics |
| `speech` | Speech synthesis voices |
| `css` | CSS computed styles |
| `cssmedia` | Media query results |
| `media` | MIME type support |
| `window` | Window properties |

### Detection Modules
| Module | Description |
|--------|-------------|
| `headless` | Automated browser detection |
| `lies` | API spoofing detection |
| `resistance` | Privacy tool detection |
| `worker` | Worker scope analysis |
| `errors` | Error pattern fingerprinting |

## API Reference

### Client

```typescript
// Create fingerprint instance
const fp = new Fingerprint(config?: FingerprintConfig);

// Collect fingerprint
const result = await fp.collect(): Promise<FingerprintResult>;

// Identify with server
const visitor = await fp.identify(serverUrl: string): Promise<IdentifyResponse>;
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fingerprint` | POST | Submit fingerprint for matching |
| `/api/fingerprint/:id` | GET | Get fingerprint details |
| `/api/visitor/:id` | GET | Get visitor history |
| `/api/stats` | GET | Get overall statistics |

## Development

```bash
# Build client
pnpm build:client

# Build server
pnpm build:server

# Run all in development mode
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint
```

## Bundle Outputs

- **ESM**: `dist/fingerprint.esm.js`
- **UMD**: `dist/fingerprint.umd.js`
- **Types**: `dist/index.d.ts`

## Credits

Inspired by [CreepJS](https://github.com/AbrahamJuliot/creepjs) (MIT License).

## License

MIT
