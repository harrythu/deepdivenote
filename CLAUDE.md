# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What This Is

DeepDiveNote -- AI-powered meeting transcription and summary generation tool. Supports up to 6-hour recordings, auto-generates structured transcripts and meeting notes.

See the parent directory's [CLAUDE.md](../CLAUDE.md) for the full-stack project overview.

## Commands

```bash
npm run dev                        # Start dev server (port 3000)
npm run build                      # Production build
npx prisma migrate deploy          # Run DB migrations
npx prisma db push                 # Push schema to DB (dev)
```

Requires PostgreSQL + Redis running (via `docker compose up -d postgres redis`).

## Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Main hub: audio upload, text paste, correction, summary generation |
| `/live` | **Live Conference** -- real-time transcription + AI assistant (connects to conference-ai backend on port 3456 via Socket.IO) |
| `/history` | User's meeting history |
| `/settings/templates` | Custom summary prompt templates |
| `/settings/vocabularies` | Custom vocabulary lists for correction |
| `/meetings/[id]` | Meeting detail: transcript + summary |

## Live Conference Page (`app/live/page.tsx`)

Connects to the conference-ai backend (separate Node.js process on port 3456) via Socket.IO. Does NOT modify the conference-ai core.

**Socket.IO protocol** (matches `conference-assistant/src/ui-web.js`):
- Emits: `start`, `pause`, `end`, `query`, `summary`, `note`
- Listens: `state`, `transcript`, `agent`, `status`

**Export handoff**: When a session ends, the accumulated transcript can be POSTed to `/api/text-upload` to create a DeepDive meeting record, skipping the audio upload/ASR pipeline and going straight to the correction + summarization flow.

**Environment**: Set `NEXT_PUBLIC_CONFERENCE_WS_URL` to override the conference-ai backend URL (default: `http://localhost:3456`).

**Auth**: Auth guard is currently disabled for testing (lines 57-62 in `page.tsx`). Re-enable by uncommenting the `useEffect` block and the `if (!isAuthenticated) return null` line.

## Tech Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- PostgreSQL 16 + Prisma 6 + Redis (BullMQ)
- Aliyun OSS (file storage) + Qwen ASR (transcription)
- Auth: cookie-based sessions via Redis
