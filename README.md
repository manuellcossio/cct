# CCT — Content Creation Tool (local)

antiq's internal content creation tool. Generates product content about antiq for X/Twitter and Instagram, plus brand ads and on-demand visual content. Runs locally with OpenAI + PostgreSQL.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24+
- **API**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI (`OPENAI_API_KEY`)
- **Frontend**: React + Vite (wouter, TanStack Query, shadcn/ui, Tailwind CSS)

## Structure

```text
artifacts/
  cct/              # CCT React frontend
  api-server/       # Express API server
  mockup-sandbox/   # UI mockup sandbox
lib/
  api-spec/         # OpenAPI spec + Orval codegen
  api-client-react/ # Generated React Query hooks
  api-zod/          # Generated Zod schemas
  db/               # Drizzle ORM + DB connection
  integrations-openai-ai-server/
  integrations-openai-ai-react/
```

## Local setup

1. Copy `.env.example` to `.env` and fill in values.
2. Install and push schema:

```bash
pnpm install
pnpm db:push
```

3. Run API + frontend (two terminals):

```bash
pnpm dev:api    # http://127.0.0.1:8080
pnpm dev:cct    # http://127.0.0.1:5173 (proxies /api → API)
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `OPENAI_API_KEY` | yes | Official OpenAI key |
| `OPENAI_BASE_URL` | no | Defaults to OpenAI API |
| `CCT_PIN` | yes | 4-digit PIN gate |
| `SESSION_SECRET` | recommended | Token HMAC secret |
| `BRAVE_SEARCH_API_KEY` | for image search | Brave Image Search |
| `PORT` | no | API default `8080`, CCT default `5173` |
| `BASE_PATH` | no | Frontend base path, default `/` |
| `API_PROXY_TARGET` | no | Vite → API proxy, default `http://127.0.0.1:8080` |

`AI_INTEGRATIONS_OPENAI_*` aliases are still accepted for compatibility.

## Features

### Twitter / X
- Generates informative product tweets grounded in `ANTIQ_BRIEF`
- Thread generation (3 deep-dive threads)
- Copy, archive, delete

### Instagram
- Product carousels (cover + content slides)
- Caption generation ending in antiq.xyz

### Ad Gen
- Instagram Story ads (1080×1920)
- Styles: mockup-dark, mockup-light, photo-bg, emotion

### Content Gen
- Brand-aware image chatbot with logo compositing
- Tools: generate image, find reference photo, add logo

## API

Routes under `/api/cct/` and `/api/auth/`. See OpenAPI in `lib/api-spec`.

## Development commands

```bash
pnpm install
pnpm run build
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/cct run dev
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```
