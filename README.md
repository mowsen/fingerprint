# Fingerprint

A research-grade browser fingerprinting system for cross-browser device identification. Built with TypeScript, featuring 25+ collection modules, multi-layer matching algorithms, and crowd-blending trust validation.

## Overview

This project provides a complete fingerprinting solution:

- **Client Library** (`@anthropic/fingerprint-client`) - Browser-side fingerprint collection with anti-tampering detection
- **Server API** (`@anthropic/fingerprint-server`) - Fingerprint matching, visitor tracking, and analytics
- **Demo App** - Next.js application showcasing real-time fingerprint collection and visualization

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Cross-Browser Recognition** | Identify the same user across Chrome, Firefox, Safari, and Brave using hardware-based stable hashing |
| **Privacy Tool Resistance** | Detect and work around Brave Shields, Firefox privacy mode, and other fingerprint randomization |
| **Multi-Layer Matching** | 6 matching strategies from exact hash to fuzzy similarity |
| **Crowd-Blending Validation** | Trust scoring based on visit patterns, IP diversity, and temporal analysis |
| **GPU Timing Fingerprinting** | DRAWNAPART technique for hardware-level identification |

## How It Works

### Fingerprint Collection

The client library collects signals from 25+ browser APIs:

| Category | Modules | Description |
|----------|---------|-------------|
| **Rendering** | canvas, webgl, svg | GPU-rendered graphics with pixel-level analysis |
| **Audio** | audio | Web Audio API oscillator and compression signatures |
| **Hardware** | gpuTiming, screen, navigator | GPU timing patterns, display info, device capabilities |
| **Fonts** | fonts | Installed system fonts and emoji rendering |
| **Browser** | timezone, intl, math, css | Locale settings, math precision, computed styles |
| **Detection** | headless, lies, resistance | Bot detection, API spoofing, privacy tool identification |

### Hash Generation

Three hash types enable different matching strategies:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Fingerprint     │     │ Fuzzy Hash   │     │ Stable Hash     │
│ (SHA-256)       │     │ (64-char)    │     │ (Hardware-only) │
├─────────────────┤     ├──────────────┤     ├─────────────────┤
│ All components  │     │ Ordered keys │     │ Screen, GPU,    │
│ Exact match     │     │ Hamming dist │     │ timezone, fonts │
│ Same browser    │     │ ~8 char diff │     │ Cross-browser   │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

### Matching Algorithm

The server uses a 6-layer matching strategy:

1. **Exact Match** (100% confidence) - Identical fingerprint hash
2. **Stable Match** (95% confidence) - Hardware features match across browsers
3. **GPU Match** (92% confidence) - DRAWNAPART timing signature match
4. **Fuzzy-Stable Match** (90%+) - Hardware hash within 4 characters
5. **Fuzzy Match** (85%+) - Browser hash within 8 characters
6. **New Visitor** - No match, create new identity

### Crowd-Blending Trust

Inspired by CreepJS, the system validates matches using behavioral patterns:

```
Trust Score = Visit Factor (0-0.4) + IP Factor (0-0.4) + Time Factor (0-0.2)

Trust Levels:
  NEW       → First visit
  RETURNING → 2+ visits, single IP
  TRUSTED   → 3+ visits, 2+ IPs
  VERIFIED  → Score ≥ 0.7
```

## Project Structure

```
fingerprint/
├── packages/
│   ├── client/                 # Browser fingerprinting library
│   │   ├── src/
│   │   │   ├── core/           # Orchestrator, crypto, stabilization
│   │   │   └── modules/        # 25+ collection modules
│   │   └── dist/               # Built library (ESM, UMD)
│   │
│   └── server/                 # Express API server
│       ├── src/
│       │   ├── routes/         # API endpoints
│       │   └── services/       # Matching, crowd-blending
│       └── prisma/             # Database schema
│
└── demo/                       # Next.js demo application
    ├── app/                    # App router pages
    └── components/             # React components
```

## Installation

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd fingerprint

# Install dependencies
pnpm install

# Set up environment variables
cp packages/server/.env.example packages/server/.env
# Edit .env with your database URL

# Initialize database
cd packages/server
pnpm db:push

# Build all packages
cd ../..
pnpm build
```

### Development

```bash
# Terminal 1: Start the server
cd packages/server
pnpm dev

# Terminal 2: Start the demo
cd demo
pnpm dev

# Open http://localhost:3000
```

## Deployment

### Option 1: Railway (Recommended)

Railway provides easy deployment with automatic PostgreSQL provisioning.

**Server Deployment:**

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database service
3. Add a new service from GitHub, select the repository
4. Configure the service:
   - **Root Directory**: `packages/server`
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
5. Add environment variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   PORT=3001
   NODE_ENV=production
   CORS_ORIGIN=https://your-demo-domain.com
   ```

**Demo Deployment:**

1. Add another service from the same repository
2. Configure:
   - **Root Directory**: `demo`
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
3. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-server-domain.railway.app
   ```

### Option 2: Docker

```dockerfile
# packages/server/Dockerfile
FROM node:18-alpine

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY packages/server ./packages/server

RUN pnpm install --filter @anthropic/fingerprint-server
RUN pnpm --filter @anthropic/fingerprint-server build

WORKDIR /app/packages/server
EXPOSE 3001
CMD ["pnpm", "start"]
```

```bash
docker build -t fingerprint-server -f packages/server/Dockerfile .
docker run -p 3001:3001 -e DATABASE_URL=postgres://... fingerprint-server
```

### Option 3: Vercel + Supabase

**Demo (Vercel):**

```bash
cd demo
vercel --prod
```

Set environment variable `NEXT_PUBLIC_API_URL` in Vercel dashboard.

**Server (Any Node.js host):**

Use Supabase for PostgreSQL, deploy server to Render, Fly.io, or similar.

## API Reference

### POST /api/fingerprint

Submit a fingerprint for matching.

**Request:**
```json
{
  "fingerprint": "a1b2c3...",
  "fuzzyHash": "d4e5f6...",
  "stableHash": "g7h8i9...",
  "gpuTimingHash": "j0k1l2...",
  "components": { },
  "entropy": 45.2,
  "detectedBrowser": "Chrome"
}
```

**Response:**
```json
{
  "visitorId": "uuid",
  "confidence": 0.95,
  "matchType": "stable",
  "isNewVisitor": false,
  "visitor": {
    "firstSeen": "2024-01-15T...",
    "visitCount": 5,
    "lastVisit": "2024-01-20T..."
  },
  "request": {
    "timestamp": "2024-01-21T...",
    "ipAddress": "192.168.1.1",
    "browser": "Firefox"
  },
  "recentVisits": [...]
}
```

### GET /api/fingerprint/:id

Get fingerprint details by ID.

### DELETE /api/fingerprint/flush

Delete all visitors, fingerprints, and sessions (development only).

### GET /api/visitor/:id

Get visitor profile with fingerprints and sessions.

### GET /api/stats

Get overall statistics including match type distribution and entropy.

### GET /api/stats/daily

Get daily statistics for trend analysis.

## Client Library Usage

### Basic Usage

```typescript
import { Fingerprint } from '@anthropic/fingerprint-client';

const fp = new Fingerprint();
const result = await fp.collect();

console.log(result.fingerprint);  // SHA-256 hash
console.log(result.fuzzyHash);    // Fuzzy hash for similarity matching
console.log(result.stableHash);   // Hardware-based cross-browser hash
console.log(result.entropy);      // Bits of entropy
console.log(result.components);   // Raw module data
```

### With Server Integration

```typescript
import { Fingerprint, LIKE_BRAVE, IS_GECKO, IS_WEBKIT } from '@anthropic/fingerprint-client';

const fp = new Fingerprint({ debug: false });

// Warm up (recommended for stability)
await fp.collect();
await fp.collect();

// Real collection
const result = await fp.collect();

// Detect browser
let browser = 'Chrome';
if (LIKE_BRAVE) browser = 'Brave';
else if (IS_GECKO) browser = 'Firefox';
else if (IS_WEBKIT) browser = 'Safari';

// Send to server
const response = await fetch('https://api.example.com/api/fingerprint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fingerprint: result.fingerprint,
    fuzzyHash: result.fuzzyHash,
    stableHash: result.stableHash,
    gpuTimingHash: result.gpuTimingHash,
    components: result.components,
    entropy: result.entropy,
    detectedBrowser: browser,
  }),
});

const data = await response.json();
console.log(`Visitor: ${data.visitorId}, Match: ${data.matchType}`);
```

### Module Selection

```typescript
// Only collect specific modules
const fp = new Fingerprint({
  modules: ['canvas', 'webgl', 'audio', 'fonts', 'screen'],
  debug: true,
});
```

### Available Modules

| Module | Description |
|--------|-------------|
| `canvas` | 2D canvas rendering fingerprint |
| `webgl` | WebGL parameters and rendered data |
| `audio` | Web Audio API fingerprint |
| `navigator` | Browser and device information |
| `screen` | Display characteristics |
| `fonts` | Installed system fonts |
| `timezone` | Timezone and locale |
| `math` | Math function precision |
| `intl` | Internationalization API |
| `webrtc` | WebRTC capabilities |
| `svg` | SVG text rendering |
| `speech` | Speech synthesis voices |
| `css` | Computed CSS properties |
| `cssmedia` | CSS media queries |
| `media` | MIME type support |
| `window` | Window properties |
| `headless` | Bot/automation detection |
| `lies` | API spoofing detection |
| `resistance` | Privacy tool detection |
| `worker` | Web Worker fingerprint |
| `errors` | Error pattern analysis |
| `gpuTiming` | GPU timing patterns (DRAWNAPART) |

## Configuration

### Server Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |

### Demo Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Server API URL | `http://localhost:3001` |

## Database Schema

```prisma
model Visitor {
  id              String        @id @default(uuid())
  fingerprints    Fingerprint[]
  sessions        Session[]
  trustLevel      TrustLevel    @default(NEW)
  crowdScore      Float         @default(0)
  uniqueIPs       Int           @default(0)
  visitCount      Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model Fingerprint {
  id              String    @id @default(uuid())
  visitor         Visitor   @relation(...)
  fingerprintHash String    // Exact browser hash
  fuzzyHash       String    // Fuzzy matching hash
  stableHash      String?   // Cross-browser hardware hash
  gpuTimingHash   String?   // GPU timing signature
  components      Json      // Raw component data
  entropy         Float?
  confidence      Float?
  isFarbled       Boolean   @default(false)
  createdAt       DateTime  @default(now())
}

model Session {
  id            String       @id @default(uuid())
  visitor       Visitor      @relation(...)
  fingerprint   Fingerprint? @relation(...)
  ipAddress     String?
  userAgent     String?
  referer       String?
  firstSeen     DateTime     @default(now())
  lastSeen      DateTime     @default(now())
}

enum TrustLevel {
  NEW        // First visit
  RETURNING  // 2+ visits, single IP
  TRUSTED    // 3+ visits, 2+ IPs
  VERIFIED   // High crowd-blending score
}
```

## Technical Details

### Multi-Render Consensus

The canvas module renders 3 times and extracts the most common pixel value per channel. This filters noise from privacy tools like Brave Shields that randomize canvas output:

```typescript
// Render multiple times
for (let i = 0; i < 3; i++) {
  ctx.clearRect(0, 0, width, height);
  renderFingerprint(ctx);
  imageDatas.push(ctx.getImageData(0, 0, width, height));
}

// Extract consensus pixels
for (let i = 0; i < pixelCount; i++) {
  const counts = new Map();
  for (const data of imageDatas) {
    const val = data.data[i];
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  result.data[i] = getMostFrequent(counts);
}
```

### GPU Timing (DRAWNAPART)

Based on the [DRAWNAPART paper](https://arxiv.org/abs/2201.09956), this module measures GPU execution timing for specific WebGL operations to create a hardware-level fingerprint that persists across browsers.

### Browser-Aware Stabilization

Different browsers require different exclusion rules for stable fingerprinting:

```typescript
const STABILIZATION_RULES = {
  private: [
    { exclude: ['canvas.dataURI'], browsers: ['firefox'] },
    { exclude: ['audio.sampleSum'], browsers: ['brave'] },
  ],
  farbled: [
    { exclude: ['canvas', 'webgl.dataURI'], browsers: ['brave'] },
  ],
};
```

## Research References

- [DRAWNAPART: GPU Fingerprinting](https://arxiv.org/abs/2201.09956) - GPU timing patterns
- [Cross-Browser Fingerprinting (NDSS 2017)](https://yinzhicao.org/TrackingFree/crossbrowsertracking_NDSS17.pdf) - 99.24% cross-browser accuracy
- [CreepJS](https://github.com/AbrahamJuliot/creepjs) - Crowd-blending, lie detection
- [ThumbmarkJS](https://github.com/nickmetal/thumbmarkjs) - Multi-render consensus
- [Brave Fingerprinting Protections](https://brave.com/privacy-updates/4-fingerprinting-defenses-2.0/) - Farbling techniques

## License

MIT
