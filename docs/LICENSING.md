# Licensing

makershelf is open source under the **AGPL v3** license. See [`LICENSE`](../LICENSE).

## License tiers (runtime)

The app supports two optional runtime tiers for self-hosted deployments:

| Tier | Use case |
|---|---|
| `community` | Personal and community use — no license server needed |
| `commercial` | Commercial deployments — validated against a license server |

## Configuration

```env
MAKERSHELF_LICENSE_TIER=community
MAKERSHELF_LICENSE_KEY=MAKERSHELF-COMMUNITY-your-instance
```

Community keys starting with `MAKERSHELF-COMMUNITY-` are accepted locally without a license server.

To connect a commercial license server, set `MAKERSHELF_LICENSE_SERVER_URL`.

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/license/status` | Current license state |
| `POST /api/license/activate` | Activate a license key |
