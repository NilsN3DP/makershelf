# Feature List

## Projects

- Project library with grid cards, filters, categories, creators and lists
- Project creation with validation for required fields
- Cover images from uploaded files or discovered project images
- Source links, tags, licenses and slicer/CAD helper actions
- Project progress, printed-file tracking, BOM entries and reference links
- ZIP export with project files and metadata

## Files and Viewers

- Upload support for STL, OBJ, 3MF, GCODE, STEP, AMF, PLY, ZIP, PDFs and images
- ZIP upload during project creation and from project detail pages
- 3D viewer for STL, OBJ, 3MF and GCODE where browser rendering is possible
- STEP and non-rendered formats show technical metadata
- PDF metadata extraction carries source information into projects where detectable
- Open files directly in PrusaSlicer, OrcaSlicer, Bambu Studio, FreeCAD or Fusion 360

## Indexing and Import

- Folder indexing with persistent session state
- Project-structure assistant for choosing the correct folder level
- Batch import with progress display
- Duplicate project-name checks before import
- Imported files are copied into the fixed project folder
- Image files found during import can be used as project covers
- URL and metadata extraction from supported sidecar files

## Organisation

- Categories with emoji, colour and description
- Creators with optional subfolders
- Favourites and custom project lists
- Duplicate overview for finding repeated project names and files

## Filaments

- Spool library with status tracking (Full, Open, Low, Empty, Archived)
- Material properties: temperatures, density, drying settings
- Net weight, tare weight and remaining weight per spool
- Manufacturer presets with per-material print profiles
- Filament database for browsing and importing manufacturer data
- Barcode scanning via browser Barcode Detection API
- NFC tag read and write in OpenPrintTag format
- Usage logging per spool linked to projects and users
- Location field for tracking storage position
- PrusaLink integration to check active printer status

## Server Edition

- Workspace bootstrap with first admin
- Login and session management
- User management, roles and permissions
- Invitation links with clipboard copy
- 2FA with QR code and downloadable backup codes
- Audit and activity views
