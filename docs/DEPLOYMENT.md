# Deployment

## Local development

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

## Docker — Server Edition

```bash
docker compose -f docker-compose.server.yml up -d
```

Open [http://localhost:3000/setup](http://localhost:3000/setup) and create your workspace.

## Unraid / NAS

Install via Unraid Community Apps — search for **makershelf**.

Or use the compose file directly:

```bash
docker compose -f docker-compose.unraid.yml up -d
```

See [`deploy/makershelf-unraid.xml`](../deploy/makershelf-unraid.xml) for the full Unraid template.

## Public HTTPS (Caddy)

1. Copy `.env.publish.example` to `.env.publish`
2. Set `MAKERSHELF_DOMAIN`, `MAKERSHELF_CONTACT_EMAIL` and all credentials
3. Start:

```bash
docker compose -f docker-compose.publish.yml --env-file .env.publish up -d
```

Includes makershelf, PostgreSQL and Caddy with automatic HTTPS.
