# Screenshots

These screenshots are generated from a real local makershelf Single preview flow. The capture script opens setup, creates a demo project, uploads real fixture files and then captures the main release pages.

## Current Files

- `setup.png`
- `projects.png`
- `project-detail.png`
- `lists.png`
- `indexing.png`
- `settings.png`

## Refresh Workflow

Start a stable Single preview first:

```bash
npm run preview:single
```

Then refresh the screenshots:

```bash
npm run docs:screenshots
```

The script targets `http://127.0.0.1:3000` by default. Set `MAKERSHELF_BASE_URL` if the preview runs on another port.
