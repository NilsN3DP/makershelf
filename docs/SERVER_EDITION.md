# Server Edition

The Server Edition is the team and self-hosted version of makershelf. It runs as a Docker container with PostgreSQL and supports multiple users, roles and invitations.

## Features

- Workspace bootstrap with first admin
- Login and session management
- User management, roles and permissions
- Invitation links
- 2FA with QR code and backup codes
- Audit log
- Server-side import folder for NAS/Unraid bulk indexing

## Docker quick start

```bash
docker compose -f docker-compose.server.yml up -d
```

Open [http://localhost:3000/setup](http://localhost:3000/setup) and create your workspace.

Change `MAKERSHELF_AUTH_SECRET` and the bootstrap credentials before exposing the instance.

## Unraid

Install via Unraid Community Apps — search for **makershelf**.

Template: [`deploy/makershelf-unraid.xml`](../deploy/makershelf-unraid.xml)

## Public HTTPS (Caddy)

Copy `.env.publish.example` to `.env.publish`, fill in your domain and credentials, then:

```bash
docker compose -f docker-compose.publish.yml --env-file .env.publish up -d
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MAKERSHELF_AUTH_SECRET` | ✅ | Long random string for sessions |
| `MAKERSHELF_BOOTSTRAP_EMAIL` | ✅ first run | First admin email |
| `MAKERSHELF_BOOTSTRAP_PASSWORD` | ✅ first run | First admin password |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `MAKERSHELF_APP_NAME` | — | Display name (default: makershelf Server) |
| `MAKERSHELF_STORAGE_ROOT` | — | Project file path inside container |
| `MAKERSHELF_IMPORT_ROOT` | — | Import folder path inside container |
