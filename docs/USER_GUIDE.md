# User Guide

## First Start

1. Open the setup wizard.
2. Enter your user name, language, theme and preferred slicer.
3. Pick a fixed project folder with the folder dialog.
4. Adjust starter categories and creators if needed.
5. Finish setup and start from the dashboard.

makershelf Single requires a real fixed project folder before imports and uploads are enabled. Relative paths such as `Projects` are only placeholders until a real folder has been selected.

## Creating Projects

1. Open `New Project`.
2. Enter title and description.
3. Choose category, creator and optional metadata.
4. Upload files directly or attach a ZIP archive.
5. Save the project and continue managing files from the project detail page.

## Managing Files

- Uploaded files are copied into the fixed project folder.
- The project folder structure keeps creator and project names readable.
- `MakershelfInfo.json` is written beside the files so the project remains understandable outside the app.
- ZIP uploads are extracted and added to the project.
- Supported 3D files can be previewed in the browser where possible.

## Indexing Existing Libraries

1. Open `Indexing`.
2. Choose an import folder.
3. Use the structure assistant to decide which folder level is the real project.
4. Select one or multiple candidates.
5. Start the import and follow the progress bar.

Imported folders remain in the indexing session until they are either imported or cancelled. Successfully imported folders are removed from the queue.

## Lists And Organization

- Use favorites for quick access.
- Create custom lists for print queues, client work or collections.
- Use categories and creators to keep large libraries searchable.
- Check duplicates regularly after large imports.

## Server Edition

The Server Edition adds login, teams, roles, invitations, 2FA and audit logging. Use it for Docker, Unraid or shared workspaces where multiple users need access.
