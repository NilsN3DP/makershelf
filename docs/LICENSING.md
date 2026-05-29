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

---

## Third-party notices

### OpenPrintTag

The Filament Vault feature uses the **OpenPrintTag** NFC tag format and draws material data from the **OpenPrintTag Material Database**.

> OpenPrintTag — open standard for 3D printing material data on NFC tags  
> Copyright 2025 PRUSA RESEARCH A.S.  
> Licensed under the MIT License  
> <https://openprinttag.org> · <https://github.com/openprinttag/openprinttag>

> OpenPrintTag Material Database — community-driven database of 3D printing materials  
> Copyright OpenPrintTag contributors  
> Licensed under the MIT License  
> <https://github.com/openprinttag/openprinttag-database>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notices and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
