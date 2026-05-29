# Contributing to makershelf

Thanks for contributing.

## Development flow

1. Fork the repository
2. Create a feature branch
3. Keep changes focused
4. Run the checks locally
5. Open a pull request with context and screenshots when UI is affected

## Local checks

```bash
npm install
npm run db:generate
npm run db:push
npm run build
```

## Pull requests

- Describe what changed
- Explain why it changed
- Mention risks or known limitations
- Add screenshots for visible UI changes

## Coding guidelines

- Prefer TypeScript-safe changes
- Keep UI text localizable
- Avoid destructive migrations without documenting impact
- Keep single-user and team mode in mind

## Issues

If you found a bug, please use the bug report template.
