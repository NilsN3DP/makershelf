# Architecture

## Frontend

- Next.js App Router
- React client components for page flows
- Central provider for UI state bridging

## Backend

- Next.js API routes
- Prisma data model
- Session-based auth
- Team bootstrap and invitation flows

## Storage strategy

- SQLite for Single Edition (local mode)
- PostgreSQL for Server Edition (team deployments)
- Filesystem storage for project files and imports

## Main areas

- `app/api/*`
  server routes
- `src/components/*`
  UI, forms and flows
- `src/lib/server/*`
  auth, bootstrap, permissions and Prisma helpers
- `prisma/*`
  schema and seed

## Scalability notes

- Paged project listings
- Dashboard count limits
- Preview size limits
- Team-ready data boundaries
