# Desktop App

makershelf Single Edition can be packaged as a local desktop application. The desktop build starts Single Edition on a local port and stores all data in the user profile.

## Platforms

| Platform | Formats |
|---|---|
| Windows | NSIS installer, portable EXE |
| Linux | AppImage, tar.gz |
| macOS | DMG, ZIP |

## Data locations

- Database: Electron `userData` folder
- Files: `Documents/makershelf`

A fresh SQLite template is copied to `userData/prisma/desktop.single.db` on first launch.

## Building locally

```bash
npm install
npm run desktop:dist:win     # Windows
npm run desktop:dist:linux   # Linux
npm run desktop:dist:mac     # macOS
```

Output lands in `release-desktop/`.

## GitHub Actions

The `desktop-packages.yml` workflow builds packages for all three platforms automatically. Pushing a version tag (e.g. `v0.2.0`) also creates a GitHub Release with the packages attached.
