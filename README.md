# makershelf

**makershelf** is a 3D print file and project manager for makers, print farms, workshops and teams.

Organise your models, track print runs, manage creators and categories — in a clean UI with multiple themes that runs locally or as a shared team server.

---

## Editions

| | Single Edition | Server Edition |
|---|---|---|
| **Storage** | SQLite (local) | PostgreSQL |
| **Auth** | No login | Email + password + 2FA |
| **Users** | One user | Invitations, roles, audit log |
| **Best for** | Personal desktop workflow | Teams, self-hosted server, NAS |

---

## Quick start

### Docker — Server Edition

```bash
docker compose -f docker-compose.server.yml up -d
```

Open [http://localhost:3000/setup](http://localhost:3000/setup) and create your workspace.

### Docker — Single Edition

```bash
docker compose -f docker-compose.single.yml up -d
```

### Local development

```bash
npm install
npm run db:generate && npm run db:push
npm run dev
```

### Unraid / NAS

Use the compose file [`docker-compose.unraid.yml`](./docker-compose.unraid.yml) or the Unraid templates in [`deploy/`](./deploy/).
The Server Edition image is published as `ghcr.io/nilsn3dp/makershelf-server:beta`.

Full deployment guide: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

## Features

- **Project library** — grid view with filters, categories, creators, tags and lists
- **File management** — upload STL/OBJ/3MF/GCODE/STEP/AMF/PLY/ZIP/PDF and images; 3D preview in browser
- **Slicer & CAD integration** — open files directly in PrusaSlicer, OrcaSlicer, Bambu Studio, FreeCAD or Fusion 360
- **Metadata import** — pull info from supported maker platforms and sidecar files
- **Active tracking** — steps, BOM, printed parts, reference links
- **ZIP export** — export a project with all files and metadata
- **Data export / import** — move data between Single and Server editions
- **Duplicates & lists** — detect dupes, build custom lists, mark favourites
- **Team features** *(Server only)* — invitations, role management, 2FA, audit log
- **Themes** — multiple UI themes with manual colour tuning
- **Spoolman** — optional sidebar link to your spool manager

---

## Tech stack

- Next.js · React · TypeScript
- Prisma (SQLite / PostgreSQL)
- Three.js for 3D preview
- Docker-ready, standalone build

---

## Known issues / Work in progress

These items are not fully resolved in the current beta:

| Area | Status | Notes |
|---|---|---|
| **2FA reset** | ⚠ No self-service | Admin account 2FA can only be disabled via the recovery endpoint (`localhost` only) or directly in the database |
| **Login error formatting** | ⚠ Partial | Empty-field submissions can surface raw Zod validation JSON instead of a user-friendly message |
| **Session poll on login** | ℹ Known | After login, the client polls `/api/auth/session` up to 12× before redirecting — adds ~200 ms per attempt on slow hosts |
| **Desktop app** | 🚧 Beta | Electron Single Edition packaging works but is not part of the public release yet |

---

## Documentation

- [Features](./docs/FEATURES.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [Server Edition](./docs/SERVER_EDITION.md)
- [Single Edition](./docs/SINGLE_EDITION.md)
- [User guide](./docs/USER_GUIDE.md)
- [Team mode](./docs/TEAM_MODE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Licensing](./docs/LICENSING.md)

---

## License

makershelf is available under the AGPL v3 license for community use.
See [docs/LICENSING.md](./docs/LICENSING.md) for details.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).
