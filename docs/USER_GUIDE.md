# User Guide

## First Start

1. Open the setup wizard at [http://localhost:3000/setup](http://localhost:3000/setup).
2. Create your workspace and first admin account.
3. Adjust starter categories and creators if needed.

## Creating Projects

1. Open `New Project`.
2. Enter title and description.
3. Choose category, creator and optional metadata.
4. Upload files directly or attach a ZIP archive.
5. Save the project and continue managing files from the project detail page.

## Managing Files

- Uploaded files are copied into the configured storage folder.
- The folder structure keeps creator and project names readable.
- ZIP uploads are extracted and added to the project.
- Supported 3D files can be previewed in the browser where possible.

## Indexing Existing Libraries

1. Open `Indexing`.
2. Choose an import folder.
3. Use the structure assistant to decide which folder level is the real project.
4. Select one or multiple candidates.
5. Start the import and follow the progress bar.

Imported folders remain in the indexing session until they are either imported or cancelled. Successfully imported folders are removed from the queue.

## Lists and Organisation

- Use favourites for quick access.
- Create custom lists for print queues, client work or collections.
- Use categories and creators to keep large libraries searchable.
- Check duplicates regularly after large imports.

## User Management

Admins can invite users, assign roles, reset 2FA and revoke access. Roles available:

- **Admin** — full access including user management
- **Editor** — standard project editing
- **Uploader** — file-heavy work without full admin rights
- **Reader** — read-only access
