# Changelog

## Unreleased

## 0.2.9-beta.28

- Drucker Farm vollständig neu aufgebaut: Gruppen mit Farbmarkierung, Standort-Feld, Tags, Detailpanel mit drei Tabs (Status / Wartung / Filament).
- Wartungs-Log je Drucker: Typ, Datum und Notizen für Düsenwechsel, Kalibrierung, Reinigung und weitere Typen.
- Filament-Verbrauch je Drucker: Gramm buchen, Auftrag zuordnen, automatisch aus dem Filament Vault abziehen.
- NFC-Spulen-Scan in der Drucker Farm: NFC-Tag lesen → Spule im Vault zuordnen → Verbrauch sofort abziehen (Chrome Android).
- Laser und Plotter in getrennte Seiten aufgeteilt (/laser und /plotter), mit eigenem Navigationsbereich "Laser & Plotter".
- Neues Plotter-Modul mit eigener Materialprofil-Bibliothek und Datei-Bibliothek (PLT, HPGL, DXF, SVG).
- Neues 3D-Tools-Werkzeug: STL → STEP AP242 Tessellated Konverter, vollständig server-seitig.
- Indexierung erkennt jetzt den Gerätetyp je Ordnergruppe (3D-Druck / Laser / Plotter) und importiert direkt in die passende Bibliothek.
- Server-seitiger Scan im Massenimport erkennt jetzt auch Laser/Plotter-Dateien (SVG, AI, EPS, DXF, PLT, HPGL).
- Spoolman-Integration aus der Navigation entfernt — Filament Vault ersetzt sie vollständig.
- Beta-Site aktualisiert mit vollständiger Installationsanleitung (Docker Compose, Unraid, Umgebungsvariablen).

## 0.2.9-beta.27

- Published the renamed makershelf Server beta channel.
- Kept legacy Print Vault/OpenPrintingVault auth secret compatibility for existing 2FA data.
- Updated tester installation notes for public GHCR beta images.
- Added a public release image archive fallback for installs without GHCR package access.
- Refreshed Unraid and Docker beta release wording.

## 0.2.8

- Updated desktop release workflow to publish installers directly as GitHub Release assets when Actions artifact storage is unavailable.

## 0.2.7

- Renamed the product, Docker images, Unraid templates and documentation to makershelf.
- Added Community and Commercial license activation endpoints with a settings UI.
- Added optional Spoolman integration with a sidebar entry when configured.
- Improved website metadata imports for Printables, Thingiverse and MakerWorld license mapping.
- Hardened server project creation and indexing imports with clearer JSON errors.
- Added licensing documentation and updated release/deployment instructions.

## 0.2.6

- Rebranded app to makershelf
- Added single-user and team mode setup flows
- Added user login, sessions, invitations and audit activity
- Added project sharing, lists and team admin tooling
- Added 3D viewer support for STL and OBJ
- Added website metadata import, ZIP workflows and folder indexing
- Added expanded localization support for German, English, French, Spanish, Italian and Dutch
- Added GitHub-ready documentation and repository templates

