# makershelf

**makershelf** is a 3D print file and project manager for makers, print farms and workshops.

Organise your models, track print runs, manage creators and categories — self-hosted with Docker or on Unraid.

---

## Quick start

### Docker

```bash
docker compose -f docker-compose.server.yml up -d
```

Open [http://localhost:3000/setup](http://localhost:3000/setup) and create your workspace.

### Unraid / NAS

Install via Unraid Community Apps — search for **makershelf**.

The image is published as `ghcr.io/nilsn3dp/makershelf-server:beta`.

Full deployment guide: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

### Local development

```bash
npm install
npm run db:generate && npm run db:push
npm run dev
```

---

## Features

- **Project library** — grid view with filters, categories, creators, tags and lists
- **File management** — upload STL/OBJ/3MF/GCODE/STEP/AMF/PLY/ZIP/PDF and images; 3D preview in browser
- **Slicer & CAD integration** — open files directly in PrusaSlicer, OrcaSlicer, Bambu Studio, FreeCAD or Fusion 360
- **Metadata import** — pull info from supported maker platforms and sidecar files
- **Active tracking** — steps, BOM, printed parts, reference links
- **ZIP export** — export a project with all files and metadata
- **Duplicates & lists** — detect dupes, build custom lists, mark favourites
- **Filament Vault** — spool library, weight logging, NFC tags in OpenPrintTag format, manufacturer presets
- **User management** — invitations, role management, 2FA, audit log
- **Themes** — multiple UI themes with manual colour tuning

---

## Tech stack

- Next.js · React · TypeScript
- Prisma (PostgreSQL)
- Three.js for 3D preview
- Docker-ready, standalone build

---

## Documentation

- [Features](./docs/FEATURES.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [Server Edition](./docs/SERVER_EDITION.md)
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
