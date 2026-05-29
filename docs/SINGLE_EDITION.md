# Single Edition

The Single Edition is the local, single-user version of makershelf. No login, no server, no team features.

## Features

- No login required
- Fixed local project folder
- SQLite database stored in the container volume
- Data export and import for migrating to Server Edition
- Hard reset to factory state

## Docker quick start

```bash
docker compose -f docker-compose.single.yml up -d
```

Open [http://localhost:3001](http://localhost:3001) and complete the setup wizard.

## Desktop app

A packaged desktop version (Windows, Linux, macOS) is available as a beta. See [DESKTOP.md](DESKTOP.md).

## Environment variables

| Variable | Description |
|---|---|
| `MAKERSHELF_APP_NAME` | Display name (default: makershelf Single) |
| `MAKERSHELF_STORAGE_ROOT` | Project file path inside container |
