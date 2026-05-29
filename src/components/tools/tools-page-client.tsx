"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import QRCode from "qrcode";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

type ToolId = "route" | "lithophane" | "tolerance" | "box" | "splitpin" | "puzzle" | "paint" | "qr";
type Vec3 = [number, number, number];
type Triangle = [Vec3, Vec3, Vec3];
type RoutePoint = { lat: number; lon: number; ele: number };
type BrightnessMap = { values: number[][]; width: number; height: number };
type GeneratedAsset = { filename: string; content: string | Blob; type: string };
type ToolPreview =
  | { kind: "stl"; content: string; title: string; stats: string[] }
  | { kind: "svg"; content: string; title: string; stats: string[] }
  | { kind: "paint"; title: string; stats: string[] };

type ToolPreset = { label: string; description: string };
type ToolMeta = {
  id: ToolId;
  title: string;
  kicker: string;
  category: string;
  description: string;
  exportLabel: string;
  promise: string;
  workflow: string[];
  outputs: string[];
  printTips: string[];
  presets: ToolPreset[];
};

const tools: ToolMeta[] = [
  {
    id: "route",
    title: "GPX / Strava Relief",
    kicker: "Route zu STL",
    category: "Creator",
    description: "Aus GPX-Tracks entsteht ein echtes Reliefmodell mit Höhenprofil, Routenspur, Basis und dokumentierten Druckdaten.",
    exportLabel: "Projektpaket exportieren",
    promise: "Fuer Touren, Laufstrecken und Geschenk-Reliefs: GPX laden, Relief kontrollieren, STL plus Projektdoku exportieren.",
    workflow: ["GPX importieren oder Demo nutzen", "Plattengröße, Reliefhöhe und Routenspur einstellen", "3D-Vorschau drehen und Höhenwirkung prüfen", "STL mit MakershelfInfo und README exportieren"],
    outputs: ["Watertight STL-Relief", "MakershelfInfo.json mit Strecke, Höhe und Parametern", "README mit Druckhinweisen"],
    printTips: ["0.16-0.24 mm Layerhöhe", "3-4 Perimeter für stabile Kanten", "Top-Layer ausreichend erhöhen, wenn die Route stark hervorgehoben wird"],
    presets: [
      { label: "Geschenkplatte", description: "120 mm, dezentes Relief, breite Route" },
      { label: "Wandbild", description: "180 mm, hohes Relief, feine Route" },
      { label: "Schnelltest", description: "80 mm, niedrige Basis, kurzer Druck" },
    ],
  },
  {
    id: "lithophane",
    title: "Lithophane Studio",
    kicker: "Bild zu STL",
    category: "Creator",
    description: "Bilder werden als druckbare Lithophane mit Rahmen, kontrollierter Mindeststärke und Vorschau erzeugt.",
    exportLabel: "Projektpaket exportieren",
    promise: "Bild laden, Stärkeprofil sauber einstellen und eine STL erzeugen, die im Slicer direkt kontrollierbar ist.",
    workflow: ["Bild importieren", "Format, min./max. Stärke und Rahmen festlegen", "Kontrast in der 3D-Vorschau prüfen", "STL und Dokumentation exportieren"],
    outputs: ["Lithophane STL", "MakershelfInfo.json mit Stärkeprofil", "README mit Licht-/Druckempfehlung"],
    printTips: ["Weisses PLA oder PETG verwenden", "0.12-0.2 mm Layerhöhe", "100% Infill oder ausreichend Perimeter für gleichmäßige Lichtwirkung"],
    presets: [
      { label: "Foto Standard", description: "120 x 80 mm, 0.8-3.2 mm" },
      { label: "Nachtlicht", description: "80 x 80 mm, dickerer Rahmen" },
      { label: "Feinauflösung", description: "Mehr Rasterpunkte, dünneres Profil" },
    ],
  },
  {
    id: "tolerance",
    title: "Calibration Lab",
    kicker: "Toleranzen prüfen",
    category: "Kalibrierung",
    description: "Erzeugt ein praxisnahes Pin-/Socket-Kit, um reale Passungen deines Druckers und Materials zu dokumentieren.",
    exportLabel: "Projektpaket exportieren",
    promise: "Nicht nur ein Testklotz: Du bekommst Messpunkte, Pin-Gauges, Socket-Ringe und eine Dokumentation für dein Druckerprofil.",
    workflow: ["Nominalmaß und Toleranzbereich festlegen", "Anzahl und Schrittweite definieren", "Kit drucken und passendste Kombination markieren", "Ergebnis in makershelf beim Material/Drucker notieren"],
    outputs: ["Pin-/Socket-STL", "MakershelfInfo.json mit Messraster", "README als Kalibrierprotokoll"],
    printTips: ["Gleiche Düsen-/Materialkombination wie später nutzen", "Außen- und Innenpassungen getrennt bewerten", "Ergebnis nicht auf andere Materialien blind übertragen"],
    presets: [
      { label: "PLA Standard", description: "10 mm, -0.25 bis +0.35 mm" },
      { label: "Enger Fit", description: "Feine 0.05-mm-Schritte" },
      { label: "Grobcheck", description: "Wenige Messpunkte für schnellen Druck" },
    ],
  },
  {
    id: "box",
    title: "Organizer Box",
    kicker: "Box mit Deckel",
    category: "Functional",
    description: "Parametrische Organizer-Box mit Wandstärke, Boden, Teilern, Deckelspiel und Projekt-Dokumentation.",
    exportLabel: "Projektpaket exportieren",
    promise: "Fuer Schrauben, Ersatzteile und Werkstatt: Abmessungen setzen, Fächer planen, Deckelspiel prüfen, Exportpaket erzeugen.",
    workflow: ["Innen-/Außenmaße und Wandstärke festlegen", "Teiler und Deckelspiel setzen", "Vorschau auf Kollisionen und Proportionen prüfen", "STL plus Fertigungshinweise exportieren"],
    outputs: ["Box-/Deckel-STL", "MakershelfInfo.json mit Gehäusedaten", "README mit Spiel- und Materialhinweisen"],
    printTips: ["Mindestens 3 Perimeter bei funktionalen Boxen", "Deckelspiel je nach Material testen", "Elefantenfuss-Kompensation im Slicer beachten"],
    presets: [
      { label: "Kleinteile", description: "90 x 60 x 36 mm, 1 Querfach" },
      { label: "Schraubenbox", description: "120 x 80 x 42 mm, mehrere Fächer" },
      { label: "Flachbox", description: "Niedrig, breiter Deckel, schnelle Ablage" },
    ],
  },
  {
    id: "splitpin",
    title: "Split & Pin Wizard",
    kicker: "Ausrichtung planen",
    category: "Repair",
    description: "Planungshilfe für Modelltrennung: Pin-Durchmesser, Socket-Spiel und Ausrichtungsabstände als druckbares Kit.",
    exportLabel: "Projektpaket exportieren",
    promise: "Hilft dir vor dem CAD-Schnitt, sinnvolle Passstift-Maße und Spielwerte für große Modelle zu finden.",
    workflow: ["Modellbreite und Schnittspalt grob abbilden", "Pin-Anzahl, Durchmesser und Länge einstellen", "Socket-Spiel prüfen", "Testkit drucken und Werte ins eigentliche Modell übernehmen"],
    outputs: ["Pin-/Socket-Testkit STL", "MakershelfInfo.json mit Passdaten", "README für Modelltrennung"],
    printTips: ["Pins liegend und stehend testen", "Spiel bei Resin/FDM unterschiedlich bewerten", "Kleber- und Lackschicht mit einrechnen"],
    presets: [
      { label: "Cosplay gross", description: "3 Pins, 6 mm, mehr Spiel" },
      { label: "Miniatur fein", description: "2-3 mm Pins, wenig Spiel" },
      { label: "Mechanisch", description: "Längere Pins, engeres Socket-Spiel" },
    ],
  },
  {
    id: "puzzle",
    title: "Puzzle Maker",
    kicker: "SVG Schneidvorlage",
    category: "2D/CNC",
    description: "Erzeugt eine skalierbare Puzzle-Schneidvorlage mit Bildhintergrund, Raster und Export für Laser/CNC oder Druckvorlage.",
    exportLabel: "Projektpaket exportieren",
    promise: "Ein schnelles 2D-Werkzeug für Vorlagen, Geschenke und CNC/Laser-Workflows mit nachvollziehbaren Parametern.",
    workflow: ["Optional Bild importieren", "Format, Reihen, Spalten und Knopfstärke setzen", "SVG-Vorschau kontrollieren", "SVG plus Projektdaten exportieren"],
    outputs: ["Puzzle SVG", "MakershelfInfo.json mit Rasterdaten", "README für Schneid-/Druckworkflow"],
    printTips: ["SVG im Zielprogramm auf echte Masse prüfen", "Kerf/Laserbreite extern kompensieren", "Fuer 3D-Druck als Vorlage oder Gravur nutzen"],
    presets: [
      { label: "Postkarte", description: "180 x 120 mm, 6 x 4 Teile" },
      { label: "Kinderleicht", description: "Grosse Teile, wenige Reihen" },
      { label: "Fein", description: "Mehr Teile und kleinere Kurven" },
    ],
  },
  {
    id: "paint",
    title: "Bemal-Planer",
    kicker: "Farbplan",
    category: "Finish",
    description: "Reduziert Referenzbilder in Farbgruppen und erzeugt einen schnellen Bemalplan für Miniaturen, Props und Dioramen.",
    exportLabel: "Projektpaket exportieren",
    promise: "Aus Referenzbildern entsteht ein dokumentierter Farbplan, den du direkt beim Projekt ablegen kannst.",
    workflow: ["Bild oder Render importieren", "Farbgruppen festlegen", "Flächenplan kontrollieren", "PNG mit Projektdoku exportieren"],
    outputs: ["PNG Bemalplan", "MakershelfInfo.json mit Farbgruppen", "README für Finish-Workflow"],
    printTips: ["Als Plan nutzen, nicht als finale Farbreferenz", "Highlights/Schatten nacharbeiten", "Originalbild im Projekt zusätzlich speichern"],
    presets: [
      { label: "Miniatur", description: "6 Farbgruppen" },
      { label: "Prop grob", description: "4 große Farbblöcke" },
      { label: "Detailreich", description: "10-12 Farbgruppen" },
    ],
  },
  {
    id: "qr",
    title: "QR Code Studio",
    kicker: "Druckbare QR-Codes",
    category: "Organisation",
    description: "Erstellt druckbare QR-Codes für Links, Texte, Projektlabels und WLAN-Zugangsdaten inklusive SVG/PNG und makershelf-Dokumentation.",
    exportLabel: "QR-Paket exportieren",
    promise: "QR-Typ wählen, Inhalt eintragen, Fehlerkorrektur und Beschriftung setzen, Vorschau prüfen und als druckbares Paket exportieren.",
    workflow: ["QR-Typ Text/Link oder WLAN wählen", "Daten eintragen und Fehlerkorrektur festlegen", "Vorschau auf Lesbarkeit und Druckgröße prüfen", "SVG/PNG plus MakershelfInfo exportieren"],
    outputs: ["Druckbares QR-SVG", "PNG für schnelle Nutzung", "MakershelfInfo.json mit Inhaltstyp und Druckparametern"],
    printTips: ["Mindestens 25-30 mm Kantenlänge für kleine Labels", "Hoher Kontrast: dunkler Code auf hellem Hintergrund", "Nach dem Druck mit zwei Smartphones testen"],
    presets: [
      { label: "Projekt-Link", description: "URL-QR mit hoher Fehlerkorrektur" },
      { label: "WLAN-Gast", description: "WLAN-QR mit WPA und SSID" },
      { label: "Inventar-Label", description: "Kurzer Text mit sichtbarer Beschriftung" },
    ],
  },
];

const sampleGpx = `<?xml version="1.0"?><gpx><trk><trkseg>
<trkpt lat="52.51" lon="13.38"><ele>40</ele></trkpt>
<trkpt lat="52.512" lon="13.385"><ele>55</ele></trkpt>
<trkpt lat="52.515" lon="13.39"><ele>65</ele></trkpt>
<trkpt lat="52.517" lon="13.399"><ele>50</ele></trkpt>
<trkpt lat="52.521" lon="13.405"><ele>72</ele></trkpt>
<trkpt lat="52.523" lon="13.411"><ele>61</ele></trkpt>
</trkseg></trk></gpx>`;

function readNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeName(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "makershelf-tool";
}

function escapeXml(value: string) {
  return value.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char] ?? char);
}

function escapeWifiQr(value: string) {
  return value.replace(/([\\;,":])/g, "\\$1");
}

function qrPayload(settings: {
  mode: "text" | "wifi";
  text: string;
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}) {
  if (settings.mode === "wifi") {
    const type = settings.encryption === "nopass" ? "nopass" : settings.encryption;
    const password = settings.encryption === "nopass" ? "" : `P:${escapeWifiQr(settings.password)};`;
    const hidden = settings.hidden ? "H:true;" : "";
    return `WIFI:T:${type};S:${escapeWifiQr(settings.ssid)};${password}${hidden};`;
  }
  return settings.text.trim() || "https://makershelf.pache.cloud";
}

async function qrSvg(payload: string, settings: { size: number; margin: number; correction: "L" | "M" | "Q" | "H"; dark: string; light: string }) {
  return QRCode.toString(payload, {
    type: "svg",
    width: settings.size,
    margin: settings.margin,
    errorCorrectionLevel: settings.correction,
    color: { dark: settings.dark, light: settings.light },
  });
}

function svgInner(svg: string) {
  const start = svg.indexOf(">");
  const end = svg.lastIndexOf("</svg>");
  return start >= 0 && end > start ? svg.slice(start + 1, end) : svg;
}

async function printableQrLabelSvg(
  payload: string,
  settings: { size: number; margin: number; correction: "L" | "M" | "Q" | "H"; dark: string; light: string },
  label: string,
) {
  const qrOnly = await qrSvg(payload, settings);
  const labelHeight = label.trim() ? Math.max(88, Math.round(settings.size * 0.14)) : 0;
  const fontSize = Math.max(24, Math.round(settings.size / 22));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.size}" height="${settings.size + labelHeight}" viewBox="0 0 ${settings.size} ${settings.size + labelHeight}">
  <rect width="100%" height="100%" fill="${escapeXml(settings.light)}"/>
  <g>${svgInner(qrOnly)}</g>
  ${label.trim() ? `<text x="${settings.size / 2}" y="${settings.size + Math.round(labelHeight * 0.58)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${escapeXml(settings.dark)}">${escapeXml(label.trim())}</text>` : ""}
</svg>`;
}

async function qrPngBlob(payload: string, settings: { size: number; margin: number; correction: "L" | "M" | "Q" | "H"; dark: string; light: string }) {
  const dataUrl = await QRCode.toDataURL(payload, {
    width: settings.size,
    margin: settings.margin,
    errorCorrectionLevel: settings.correction,
    color: { dark: settings.dark, light: settings.light },
  });
  const response = await fetch(dataUrl);
  return response.blob();
}

function canvasToBlob(canvas: HTMLCanvasElement | null) {
  return new Promise<Blob>((resolve, reject) => {
    if (!canvas) {
      reject(new Error("Canvas ist nicht bereit."));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG konnte nicht erzeugt werden."));
    }, "image/png");
  });
}

async function downloadZip(filename: string, assets: GeneratedAsset[]) {
  const zip = new JSZip();
  for (const asset of assets) {
    zip.file(asset.filename, asset.content);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function makershelfInfo(tool: string, parameters: Record<string, unknown>, notes: string[]) {
  return JSON.stringify(
    {
      app: "makershelf",
      tool,
      generatedAt: new Date().toISOString(),
      parameters,
      notes,
      workflow: "Generated by makershelf Werkzeugbank. Import the generated asset files as a project if desired.",
    },
    null,
    2,
  );
}

function readme(tool: string, notes: string[]) {
  return [
    `makershelf Werkzeug: ${tool}`,
    "",
    "Inhalt:",
    "- Modell-/Vorlagendateien aus dem aktiven Werkzeug",
    "- MakershelfInfo.json mit Parametern und Herkunft",
    "- README.txt mit Druck- und Nutzungshinweisen",
    "",
    "Hinweise:",
    ...notes.map((note) => `- ${note}`),
    "",
    "Tipp: Lege das ZIP oder die enthaltenen Dateien direkt als neues makershelf-Projekt ab.",
  ].join("\n");
}

function packagedAssets(tool: string, parameters: Record<string, unknown>, notes: string[], primary: GeneratedAsset[]) {
  return [
    ...primary,
    { filename: "MakershelfInfo.json", content: makershelfInfo(tool, parameters, notes), type: "application/json" },
    { filename: "README.txt", content: readme(tool, notes), type: "text/plain" },
  ];
}

function parseAsciiStl(stl: string) {
  const vertices: number[] = [];
  for (const line of stl.split("\n")) {
    const match = line.trim().match(/^vertex\s+(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)/i);
    if (match) vertices.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  return vertices;
}

function StlWorkbenchViewer({ stl, title }: { stl: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const vertices = parseAsciiStl(stl);
    host.replaceChildren();
    if (vertices.length < 9) {
      host.textContent = "Keine Vorschau-Geometrie vorhanden.";
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07101d);
    const initialWidth = Math.max(280, Math.round(host.getBoundingClientRect().width || host.parentElement?.getBoundingClientRect().width || 320));
    const initialHeight = Math.max(240, Math.round(host.getBoundingClientRect().height || 320));
    const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.center();
    const material = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55, metalness: 0.08 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z, 1);
    camera.position.set(maxSize * 0.95, -maxSize * 1.35, maxSize * 0.85);
    camera.near = maxSize / 100;
    camera.far = maxSize * 20;
    camera.updateProjectionMatrix();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(maxSize, -maxSize, maxSize * 1.5);
    scene.add(key);
    const grid = new THREE.GridHelper(Math.max(40, maxSize * 1.8), 20, 0x1d4ed8, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      const width = Math.max(280, Math.round(host.getBoundingClientRect().width || 320));
      const height = Math.max(240, Math.round(host.getBoundingClientRect().height || 320));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [stl]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-slate-950/80">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm">
        <strong>{title}</strong>
        <span className="text-muted">Drehen, zoomen, prüfen</span>
      </div>
      <div ref={hostRef} className="viewer-frame w-full" aria-label={`${title} 3D Vorschau`} />
    </div>
  );
}

function parseGpx(text: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  const pointPattern = /<(trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of text.matchAll(pointPattern)) {
    const attrs = match[2] ?? "";
    const body = match[3] ?? "";
    const lat = readNumber(attrs.match(/\blat=["']([^"']+)["']/i)?.[1] ?? "", 0);
    const lon = readNumber(attrs.match(/\blon=["']([^"']+)["']/i)?.[1] ?? "", 0);
    const ele = readNumber(body.match(/<ele>([^<]+)<\/ele>/i)?.[1] ?? "", 0);
    if (lat !== 0 || lon !== 0) points.push({ lat, lon, ele });
  }
  return points;
}

function haversine(a: RoutePoint, b: RoutePoint) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function routeStats(points: RoutePoint[]) {
  let distance = 0;
  let gain = 0;
  for (let i = 1; i < points.length; i += 1) {
    distance += haversine(points[i - 1], points[i]);
    gain += Math.max(0, points[i].ele - points[i - 1].ele);
  }
  return { distance, gain };
}

function normalizeRoute(points: RoutePoint[], width: number, depth: number) {
  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const minLon = Math.min(...points.map((p) => p.lon));
  const maxLon = Math.max(...points.map((p) => p.lon));
  const latSpan = maxLat - minLat || 1;
  const lonSpan = maxLon - minLon || 1;
  return points.map((point) => ({
    x: ((point.lon - minLon) / lonSpan - 0.5) * width,
    y: ((point.lat - minLat) / latSpan - 0.5) * depth,
    ele: point.ele,
  }));
}

function boxTriangles(width: number, depth: number, height: number, cx = 0, cy = 0, cz = 0): Triangle[] {
  const x = width / 2;
  const y = depth / 2;
  const z = height / 2;
  const p = {
    lbf: [cx - x, cy - y, cz - z] as Vec3,
    rbf: [cx + x, cy - y, cz - z] as Vec3,
    rbb: [cx + x, cy + y, cz - z] as Vec3,
    lbb: [cx - x, cy + y, cz - z] as Vec3,
    ltf: [cx - x, cy - y, cz + z] as Vec3,
    rtf: [cx + x, cy - y, cz + z] as Vec3,
    rtb: [cx + x, cy + y, cz + z] as Vec3,
    ltb: [cx - x, cy + y, cz + z] as Vec3,
  };
  return [
    [p.lbf, p.rbf, p.rbb], [p.lbf, p.rbb, p.lbb],
    [p.ltf, p.ltb, p.rtb], [p.ltf, p.rtb, p.rtf],
    [p.lbf, p.ltf, p.rtf], [p.lbf, p.rtf, p.rbf],
    [p.rbf, p.rtf, p.rtb], [p.rbf, p.rtb, p.rbb],
    [p.rbb, p.rtb, p.ltb], [p.rbb, p.ltb, p.lbb],
    [p.lbb, p.ltb, p.ltf], [p.lbb, p.ltf, p.lbf],
  ];
}

function cylinderXTriangles(length: number, radius: number, cx: number, cy: number, cz: number, segments = 24): Triangle[] {
  const tris: Triangle[] = [];
  const left = cx - length / 2;
  const right = cx + length / 2;
  const leftCenter: Vec3 = [left, cy, cz];
  const rightCenter: Vec3 = [right, cy, cz];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const la: Vec3 = [left, cy + Math.cos(a) * radius, cz + Math.sin(a) * radius];
    const lb: Vec3 = [left, cy + Math.cos(b) * radius, cz + Math.sin(b) * radius];
    const ra: Vec3 = [right, cy + Math.cos(a) * radius, cz + Math.sin(a) * radius];
    const rb: Vec3 = [right, cy + Math.cos(b) * radius, cz + Math.sin(b) * radius];
    tris.push([la, ra, rb], [la, rb, lb], [leftCenter, lb, la], [rightCenter, ra, rb]);
  }
  return tris;
}

function cylinderZTriangles(height: number, radius: number, cx: number, cy: number, cz: number, segments = 36): Triangle[] {
  const tris: Triangle[] = [];
  const bottom = cz - height / 2;
  const top = cz + height / 2;
  const bottomCenter: Vec3 = [cx, cy, bottom];
  const topCenter: Vec3 = [cx, cy, top];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const ba: Vec3 = [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, bottom];
    const bb: Vec3 = [cx + Math.cos(b) * radius, cy + Math.sin(b) * radius, bottom];
    const ta: Vec3 = [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, top];
    const tb: Vec3 = [cx + Math.cos(b) * radius, cy + Math.sin(b) * radius, top];
    tris.push([ba, ta, tb], [ba, tb, bb], [bottomCenter, bb, ba], [topCenter, ta, tb]);
  }
  return tris;
}

function tubeZTriangles(height: number, outerRadius: number, innerRadius: number, cx: number, cy: number, cz: number, segments = 48): Triangle[] {
  const tris: Triangle[] = [];
  const bottom = cz - height / 2;
  const top = cz + height / 2;
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const obA: Vec3 = [cx + Math.cos(a) * outerRadius, cy + Math.sin(a) * outerRadius, bottom];
    const obB: Vec3 = [cx + Math.cos(b) * outerRadius, cy + Math.sin(b) * outerRadius, bottom];
    const otA: Vec3 = [cx + Math.cos(a) * outerRadius, cy + Math.sin(a) * outerRadius, top];
    const otB: Vec3 = [cx + Math.cos(b) * outerRadius, cy + Math.sin(b) * outerRadius, top];
    const ibA: Vec3 = [cx + Math.cos(a) * innerRadius, cy + Math.sin(a) * innerRadius, bottom];
    const ibB: Vec3 = [cx + Math.cos(b) * innerRadius, cy + Math.sin(b) * innerRadius, bottom];
    const itA: Vec3 = [cx + Math.cos(a) * innerRadius, cy + Math.sin(a) * innerRadius, top];
    const itB: Vec3 = [cx + Math.cos(b) * innerRadius, cy + Math.sin(b) * innerRadius, top];
    tris.push([obA, otA, otB], [obA, otB, obB]);
    tris.push([ibA, itB, itA], [ibA, ibB, itB]);
    tris.push([otA, itA, itB], [otA, itB, otB]);
    tris.push([obA, ibB, ibA], [obA, obB, ibB]);
  }
  return tris;
}

function normalOf(triangle: Triangle): Vec3 {
  const [a, b, c] = triangle;
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function stlFromTriangles(name: string, triangles: Triangle[]) {
  const lines = [`solid ${safeName(name)}`];
  for (const triangle of triangles) {
    const normal = normalOf(triangle);
    lines.push(`facet normal ${normal[0]} ${normal[1]} ${normal[2]}`, "outer loop");
    for (const point of triangle) lines.push(`vertex ${point[0]} ${point[1]} ${point[2]}`);
    lines.push("endloop", "endfacet");
  }
  lines.push(`endsolid ${safeName(name)}`);
  return lines.join("\n");
}

function stlFromHeightField(name: string, heights: number[][], width: number, depth: number, base: number) {
  const rows = heights.length;
  const cols = heights[0]?.length ?? 0;
  const triangles: Triangle[] = [];
  const point = (x: number, y: number, top = true): Vec3 => [
    (x / (cols - 1) - 0.5) * width,
    (y / (rows - 1) - 0.5) * depth,
    top ? heights[y][x] + base : 0,
  ];
  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < cols - 1; x += 1) {
      triangles.push([point(x, y), point(x + 1, y), point(x + 1, y + 1)]);
      triangles.push([point(x, y), point(x + 1, y + 1), point(x, y + 1)]);
      triangles.push([point(x, y + 1, false), point(x + 1, y + 1, false), point(x + 1, y, false)]);
      triangles.push([point(x, y + 1, false), point(x + 1, y, false), point(x, y, false)]);
    }
  }
  for (let x = 0; x < cols - 1; x += 1) {
    triangles.push([point(x, 0, false), point(x + 1, 0, false), point(x + 1, 0)]);
    triangles.push([point(x, 0, false), point(x + 1, 0), point(x, 0)]);
    triangles.push([point(x + 1, rows - 1, false), point(x, rows - 1, false), point(x, rows - 1)]);
    triangles.push([point(x + 1, rows - 1, false), point(x, rows - 1), point(x + 1, rows - 1)]);
  }
  for (let y = 0; y < rows - 1; y += 1) {
    triangles.push([point(0, y + 1, false), point(0, y, false), point(0, y)]);
    triangles.push([point(0, y + 1, false), point(0, y), point(0, y + 1)]);
    triangles.push([point(cols - 1, y, false), point(cols - 1, y + 1, false), point(cols - 1, y + 1)]);
    triangles.push([point(cols - 1, y, false), point(cols - 1, y + 1), point(cols - 1, y)]);
  }
  return stlFromTriangles(name, triangles);
}

function imageToBrightness(image: HTMLImageElement, width: number, height: number): BrightnessMap {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return demoBrightness(width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const values = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const offset = (y * width + x) * 4;
      return (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) / 255;
    }),
  );
  return { values, width, height };
}

function demoBrightness(width: number, height: number): BrightnessMap {
  const values = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => 0.5 + Math.sin(x / 6) * 0.2 + Math.cos(y / 8) * 0.2),
  );
  return { values, width, height };
}

function loadImageFile(file: File, onLoad: (image: HTMLImageElement, dataUrl: string, name: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new window.Image();
    image.onload = () => onLoad(image, String(reader.result), file.name.replace(/\.[^.]+$/, ""));
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

function makeRouteHeights(points: RoutePoint[], grid: number, relief: number, routeWidth: number) {
  const normalized = normalizeRoute(points, 120, 120);
  const minEle = Math.min(...points.map((p) => p.ele));
  const maxEle = Math.max(...points.map((p) => p.ele));
  const span = maxEle - minEle || 1;
  return Array.from({ length: grid }, (_, y) =>
    Array.from({ length: grid }, (_, x) => {
      const px = (x / (grid - 1) - 0.5) * 120;
      const py = (y / (grid - 1) - 0.5) * 120;
      let boost = 0;
      for (const point of normalized) {
        const distance = Math.hypot(px - point.x, py - point.y);
        boost = Math.max(boost, Math.max(0, 1 - distance / routeWidth) * ((point.ele - minEle) / span));
      }
      return boost * relief;
    }),
  );
}

function makeLithophaneStl(image: HTMLImageElement | null, width: number, height: number, min: number, max: number, grid: number, frame: number) {
  const cols = Math.max(12, grid);
  const rows = Math.max(12, Math.round((grid * height) / width));
  const map = image ? imageToBrightness(image, cols, rows) : demoBrightness(cols, rows);
  const heights = map.values.map((row) => row.map((value) => min + (1 - value) * (max - min)));
  if (frame <= 0) return stlFromHeightField("lithophane", heights, width, height, 0);
  const relief = stlFromHeightField("lithophane", heights, width, height, 0);
  const frameHeight = max + 0.8;
  const frameTriangles = [
    ...boxTriangles(width + frame * 2, frame, frameHeight, 0, -height / 2 - frame / 2, frameHeight / 2),
    ...boxTriangles(width + frame * 2, frame, frameHeight, 0, height / 2 + frame / 2, frameHeight / 2),
    ...boxTriangles(frame, height, frameHeight, -width / 2 - frame / 2, 0, frameHeight / 2),
    ...boxTriangles(frame, height, frameHeight, width / 2 + frame / 2, 0, frameHeight / 2),
  ];
  return relief.replace("endsolid lithophane", "") + stlFromTriangles("lithophane-frame", frameTriangles).replace("solid lithophane-frame", "").replace("endsolid lithophane-frame", "endsolid lithophane");
}

function makeToleranceModel(nominal: number, start: number, step: number, count: number, height: number) {
  const tris: Triangle[] = [];
  const spacing = nominal * 2.8;
  const plateWidth = spacing * count + nominal;
  const plateDepth = nominal * 5.4;
  const plateHeight = 2.4;
  tris.push(...boxTriangles(plateWidth, plateDepth, plateHeight, 0, 0, plateHeight / 2));
  for (let i = 0; i < count; i += 1) {
    const diameter = nominal + start + i * step;
    const x = (i - (count - 1) / 2) * spacing;
    tris.push(...cylinderZTriangles(height, diameter / 2, x, -nominal * 1.2, plateHeight + height / 2));
    tris.push(...tubeZTriangles(height * 0.72, diameter / 2 + 1.1, Math.max(0.8, diameter / 2), x, nominal * 1.45, plateHeight + (height * 0.72) / 2));
  }
  return stlFromTriangles("tolerance-test", tris);
}

function makeBoxModel(width: number, depth: number, height: number, wall: number, bottom: number, dividersX: number, dividersY: number, lidClearance: number) {
  const tris: Triangle[] = [];
  tris.push(...boxTriangles(width, depth, bottom, 0, 0, bottom / 2));
  tris.push(...boxTriangles(width, wall, height, 0, -depth / 2 + wall / 2, bottom + height / 2));
  tris.push(...boxTriangles(width, wall, height, 0, depth / 2 - wall / 2, bottom + height / 2));
  tris.push(...boxTriangles(wall, depth, height, -width / 2 + wall / 2, 0, bottom + height / 2));
  tris.push(...boxTriangles(wall, depth, height, width / 2 - wall / 2, 0, bottom + height / 2));
  const innerWidth = Math.max(4, width - wall * 2);
  const innerDepth = Math.max(4, depth - wall * 2);
  for (let i = 1; i <= dividersX; i += 1) {
    const x = -innerWidth / 2 + (innerWidth / (dividersX + 1)) * i;
    tris.push(...boxTriangles(wall * 0.82, innerDepth, height * 0.82, x, 0, bottom + (height * 0.82) / 2));
  }
  for (let i = 1; i <= dividersY; i += 1) {
    const y = -innerDepth / 2 + (innerDepth / (dividersY + 1)) * i;
    tris.push(...boxTriangles(innerWidth, wall * 0.82, height * 0.82, 0, y, bottom + (height * 0.82) / 2));
  }
  const lidX = width * 1.35;
  const lidThickness = Math.max(1.8, bottom * 0.75);
  tris.push(...boxTriangles(width, depth, lidThickness, lidX, 0, lidThickness / 2));
  tris.push(...boxTriangles(width - wall * 2 - lidClearance, wall, wall * 1.35, lidX, -depth / 2 + wall * 1.5, lidThickness + wall * 0.65));
  tris.push(...boxTriangles(width - wall * 2 - lidClearance, wall, wall * 1.35, lidX, depth / 2 - wall * 1.5, lidThickness + wall * 0.65));
  tris.push(...boxTriangles(wall, depth - wall * 2 - lidClearance, wall * 1.35, lidX - width / 2 + wall * 1.5, 0, lidThickness + wall * 0.65));
  tris.push(...boxTriangles(wall, depth - wall * 2 - lidClearance, wall * 1.35, lidX + width / 2 - wall * 1.5, 0, lidThickness + wall * 0.65));
  return stlFromTriangles("box-generator", tris);
}

function makeSplitPinModel(width: number, depth: number, height: number, gap: number, pins: number, pinDiameter: number, pinLength: number, clearance: number) {
  const tris: Triangle[] = [];
  tris.push(...boxTriangles(width / 2 - gap / 2, depth, height, -width / 4 - gap / 4, 0, height / 2));
  tris.push(...boxTriangles(width / 2 - gap / 2, depth, height, width / 4 + gap / 4, 0, height / 2));
  for (let i = 0; i < pins; i += 1) {
    const y = pins === 1 ? 0 : (i / (pins - 1) - 0.5) * depth * 0.7;
    tris.push(...cylinderXTriangles(pinLength, pinDiameter / 2, -gap / 2 - pinLength / 2, y, height * 0.58, 36));
    tris.push(...tubeZTriangles(pinLength * 0.72, pinDiameter / 2 + clearance + 1.1, pinDiameter / 2 + clearance, width / 4 + gap / 2, y, height + pinLength * 0.36, 42));
  }
  return stlFromTriangles("split-pin-plan", tris);
}

function makePuzzlePath(width: number, height: number, cols: number, rows: number, knob: number) {
  const cellW = width / cols;
  const cellH = height / rows;
  const parts: string[] = [`M 0 0 H ${width} V ${height} H 0 Z`];
  for (let c = 1; c < cols; c += 1) {
    const x = c * cellW;
    parts.push(`M ${x} 0`);
    for (let r = 0; r < rows; r += 1) {
      const y = r * cellH;
      const dir = (c + r) % 2 === 0 ? 1 : -1;
      parts.push(`C ${x} ${y + cellH * 0.25}, ${x + dir * cellW * knob} ${y + cellH * 0.35}, ${x} ${y + cellH * 0.5}`);
      parts.push(`C ${x - dir * cellW * knob} ${y + cellH * 0.65}, ${x} ${y + cellH * 0.75}, ${x} ${y + cellH}`);
    }
  }
  for (let r = 1; r < rows; r += 1) {
    const y = r * cellH;
    parts.push(`M 0 ${y}`);
    for (let c = 0; c < cols; c += 1) {
      const x = c * cellW;
      const dir = (c + r) % 2 === 0 ? 1 : -1;
      parts.push(`C ${x + cellW * 0.25} ${y}, ${x + cellW * 0.35} ${y + dir * cellH * knob}, ${x + cellW * 0.5} ${y}`);
      parts.push(`C ${x + cellW * 0.65} ${y - dir * cellH * knob}, ${x + cellW * 0.75} ${y}, ${x + cellW} ${y}`);
    }
  }
  return parts.join(" ");
}

function makePuzzleSvg(width: number, height: number, cols: number, rows: number, knob: number, imageData?: string) {
  const image = imageData ? `<image href="${imageData}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="0.72"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f7f2e8"/>
  ${image}
  <path d="${makePuzzlePath(width, height, cols, rows, knob)}" fill="none" stroke="#111827" stroke-width="0.35"/>
</svg>`;
}

function drawPaintPlan(canvas: HTMLCanvasElement | null, image: HTMLImageElement | null, colors: number) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = 700;
  const height = 440;
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, width, height);
  if (image) {
    ctx.drawImage(image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < data.data.length; i += 4) {
      for (let c = 0; c < 3; c += 1) {
        data.data[i + c] = Math.round(data.data[i + c] / (255 / colors)) * (255 / colors);
      }
    }
    ctx.putImageData(data, 0, 0);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f97316");
    gradient.addColorStop(0.5, "#1e293b");
    gradient.addColorStop(1, "#38bdf8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
  ctx.fillRect(20, 20, 210, 82);
  ctx.fillStyle = "#fff";
  ctx.font = "700 22px sans-serif";
  ctx.fillText("makershelf Paint Plan", 36, 55);
  ctx.font = "14px sans-serif";
  ctx.fillText(`${colors} Farbgruppen`, 36, 82);
}

function NumberControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between text-sm font-semibold">
        {label}
        <span className="text-muted">{value}{unit ? ` ${unit}` : ""}</span>
      </span>
      <input className="accent-[var(--color-primary)]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(readNumber(event.target.value, value))} />
      <input className="field" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(readNumber(event.target.value, value))} />
    </label>
  );
}

function FileInput({ label, accept, onFile }: { label: string; accept: string; onFile: (file: File) => void }) {
  return (
    <label className="btn-secondary inline-flex cursor-pointer justify-center">
      {label}
      <input className="sr-only" type="file" accept={accept} onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
        event.target.value = "";
      }} />
    </label>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function ToolInfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function toleranceCsv(nominal: number, start: number, step: number, count: number) {
  const rows = ["index,target_mm,result_fit,notes"];
  for (let i = 0; i < count; i += 1) {
    rows.push(`${i + 1},${(nominal + start + step * i).toFixed(3)},,`);
  }
  return rows.join("\n");
}

function boxOpenScad(settings: { width: number; depth: number; height: number; wall: number; bottom: number; dividersX: number; dividersY: number; lidClearance: number }) {
  return `// makershelf Organizer Box
// Render in OpenSCAD for a boolean-clean editable model.
$fn = 48;
w = ${settings.width};
d = ${settings.depth};
h = ${settings.height};
wall = ${settings.wall};
bottom = ${settings.bottom};
clearance = ${settings.lidClearance};
div_x = ${settings.dividersX};
div_y = ${settings.dividersY};

module open_box() {
  difference() {
    cube([w, d, h], center=false);
    translate([wall, wall, bottom])
      cube([w - wall * 2, d - wall * 2, h], center=false);
  }
  for (i = [1:div_x]) {
    translate([i * (w - wall * 2) / (div_x + 1) + wall - wall / 2, wall, bottom])
      cube([wall, d - wall * 2, h - bottom], center=false);
  }
  for (i = [1:div_y]) {
    translate([wall, i * (d - wall * 2) / (div_y + 1) + wall - wall / 2, bottom])
      cube([w - wall * 2, wall, h - bottom], center=false);
  }
}

module friction_lid() {
  translate([0, d + 12, 0]) {
    cube([w, d, wall], center=false);
    translate([wall + clearance, wall + clearance, wall])
      cube([w - (wall + clearance) * 2, d - (wall + clearance) * 2, wall], center=false);
  }
}

open_box();
friction_lid();
`;
}

function splitPinOpenScad(settings: { width: number; depth: number; height: number; gap: number; pins: number; pinDiameter: number; pinLength: number; clearance: number }) {
  return `// makershelf Split & Pin planning kit
$fn = 48;
w = ${settings.width};
d = ${settings.depth};
h = ${settings.height};
gap = ${settings.gap};
pins = ${settings.pins};
pin_d = ${settings.pinDiameter};
pin_l = ${settings.pinLength};
clearance = ${settings.clearance};

module half_plate(xoff) {
  translate([xoff, 0, 0]) cube([(w - gap) / 2, d, h], center=true);
}

module pin(x, y) {
  translate([x, y, h / 2 + pin_l / 2])
    cylinder(h=pin_l, d=pin_d, center=true);
}

module socket_marker(x, y) {
  translate([x, y, h / 2 + 1])
    cylinder(h=2, d=pin_d + clearance * 2, center=true);
}

half_plate(-(w + gap) / 4);
half_plate((w + gap) / 4);
for (i = [0:pins-1]) {
  y = pins == 1 ? 0 : -d * 0.32 + i * (d * 0.64) / (pins - 1);
  pin(-gap / 2 - pin_l / 4, y);
  socket_marker(gap / 2 + pin_l / 4, y);
}
`;
}

export function ToolsPageClient() {
  const { settings } = useMakershelf();
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const [devEnabled, setDevEnabled] = useState(false);
  const [active, setActive] = useState<ToolId>("route");
  const [status, setStatus] = useState("Bereit.");
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(() => parseGpx(sampleGpx));
  const [routeSettings, setRouteSettings] = useState({ size: 120, base: 2.8, relief: 18, routeWidth: 9, grid: 44 });
  const [litho, setLitho] = useState({ image: null as HTMLImageElement | null, name: "lithophane", width: 120, height: 80, min: 0.8, max: 3.2, grid: 48, frame: 4 });
  const [tolerance, setTolerance] = useState({ nominal: 10, start: -0.25, step: 0.1, count: 7, height: 10 });
  const [box, setBox] = useState({ width: 90, depth: 60, height: 36, wall: 2.4, bottom: 2.8, dividersX: 1, dividersY: 0, lidClearance: 0.35 });
  const [splitpin, setSplitpin] = useState({ width: 120, depth: 70, height: 20, gap: 7, pins: 3, pinDiameter: 6, pinLength: 18, clearance: 0.25 });
  const [puzzle, setPuzzle] = useState({ imageData: "", width: 180, height: 120, cols: 6, rows: 4, knob: 0.26 });
  const [paint, setPaint] = useState({ image: null as HTMLImageElement | null, name: "paint-plan", colors: 6 });
  const [qr, setQr] = useState({
    mode: "text" as "text" | "wifi",
    text: "https://makershelf.pache.cloud",
    ssid: "Makershelf Guest",
    password: "ChangeMe123!",
    encryption: "WPA" as "WPA" | "WEP" | "nopass",
    hidden: false,
    label: "makershelf",
    size: 768,
    margin: 3,
    correction: "H" as "L" | "M" | "Q" | "H",
    dark: "#0b1424",
    light: "#ffffff",
  });
  const [qrCodeSvg, setQrCodeSvg] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const flags = JSON.parse(window.localStorage.getItem("makershelf.dev.flags") || "[]");
        setDevEnabled(Array.isArray(flags) && flags.includes("workshop-tools"));
      } catch {
        setDevEnabled(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeTool = tools.find((tool) => tool.id === active) ?? tools[0];
  const stats = useMemo(() => routeStats(routePoints), [routePoints]);
  const toolMetrics = useMemo(() => {
    if (active === "route") {
      return [
        { label: "Strecke", value: `${stats.distance.toFixed(1)} km` },
        { label: "Höhenmeter", value: `${Math.round(stats.gain)} m` },
        { label: "Druckzeit grob", value: formatMinutes(routeSettings.size * routeSettings.size * 0.003 + routeSettings.relief * 2) },
      ];
    }
    if (active === "lithophane") {
      return [
        { label: "Format", value: `${litho.width} x ${litho.height} mm` },
        { label: "Stärke", value: `${litho.min}-${litho.max} mm` },
        { label: "Druckzeit grob", value: formatMinutes((litho.width * litho.height * litho.max) / 850) },
      ];
    }
    if (active === "tolerance") {
      const end = tolerance.nominal + tolerance.start + tolerance.step * (tolerance.count - 1);
      return [
        { label: "Messpunkte", value: String(tolerance.count) },
        { label: "Bereich", value: `${(tolerance.nominal + tolerance.start).toFixed(2)}-${end.toFixed(2)} mm` },
        { label: "Druckzeit grob", value: formatMinutes(tolerance.count * 9) },
      ];
    }
    if (active === "box") {
      const volume = Math.round((box.width * box.depth * box.height) / 1000);
      return [
        { label: "Volumen", value: `${volume} cm³` },
        { label: "Fächer", value: String((box.dividersX + 1) * (box.dividersY + 1)) },
        { label: "Druckzeit grob", value: formatMinutes(volume * 2.2) },
      ];
    }
    if (active === "splitpin") {
      return [
        { label: "Pins", value: String(splitpin.pins) },
        { label: "Durchmesser", value: `${splitpin.pinDiameter} mm` },
        { label: "Druckzeit grob", value: formatMinutes(splitpin.pins * 12 + 25) },
      ];
    }
    if (active === "puzzle") {
      return [
        { label: "Teile", value: String(puzzle.cols * puzzle.rows) },
        { label: "Format", value: `${puzzle.width} x ${puzzle.height} mm` },
        { label: "Export", value: "SVG" },
      ];
    }
    if (active === "qr") {
      return [
        { label: "Typ", value: qr.mode === "wifi" ? "WLAN" : "Text/Link" },
        { label: "Korrektur", value: qr.correction },
        { label: "Export", value: "SVG + PNG" },
      ];
    }
    return [
      { label: "Farben", value: String(paint.colors) },
      { label: "Export", value: "PNG" },
      { label: "Nutzung", value: "Finish" },
    ];
  }, [active, box, litho, paint.colors, puzzle, qr.correction, qr.mode, routeSettings, splitpin, stats.distance, stats.gain, tolerance]);
  const qualityChecks = useMemo(() => {
    const checks: string[] = [];
    if (active === "route") {
      checks.push(routePoints.length >= 2 ? "Trackdaten vorhanden" : "Bitte GPX mit mindestens zwei Punkten laden");
      checks.push(routeSettings.base >= 2 ? "Basis ist stabil genug" : "Basis für FDM besser auf mindestens 2 mm setzen");
      checks.push(routeSettings.routeWidth <= routeSettings.size / 6 ? "Routenspur wirkt proportional" : "Routenspur ist sehr breit für die Platte");
    }
    if (active === "lithophane") {
      checks.push(litho.min >= 0.6 ? "Mindeststärke ist druckbar" : "Mindeststärke kann zu dünner Lithophane fuehren");
      checks.push(litho.max - litho.min >= 1.2 ? "Kontrastbereich sinnvoll" : "Mehr Unterschied zwischen min. und max. Stärke gibt besseren Kontrast");
      checks.push(litho.frame > 0 ? "Rahmen stabilisiert das Teil" : "Ohne Rahmen nur mit vorsichtiger Ausrichtung drucken");
    }
    if (active === "tolerance") {
      checks.push(tolerance.count >= 5 ? "Genug Messpunkte für Vergleich" : "Mehr Messpunkte machen den Test aussagekräftiger");
      checks.push(tolerance.step <= 0.15 ? "Schrittweite ist fein genug" : "Für Passungen besser 0.05-0.10 mm Schritte nutzen");
      checks.push("Nach Druck passende Werte am Materialprofil dokumentieren");
    }
    if (active === "box") {
      checks.push(box.wall >= 2 ? "Wandstärke ist robust" : "Für FDM besser mindestens 2 mm Wandstärke");
      checks.push(box.lidClearance >= 0.25 ? "Deckelspiel ist realistisch" : "Deckelspiel kann zu eng sein");
      checks.push(box.height > box.bottom + 8 ? "Innenraum bleibt nutzbar" : "Höhe ist sehr knapp für den Boden");
    }
    if (active === "splitpin") {
      checks.push(splitpin.clearance >= 0.15 ? "Socket-Spiel ist für FDM realistisch" : "Sehr enges Spiel nur für kalibrierte Drucker");
      checks.push(splitpin.pinLength >= splitpin.pinDiameter * 2 ? "Pin-Länge stabilisiert gut" : "Pins duerfen für große Teile länger sein");
      checks.push("Testkit vor dem finalen Modell-Schnitt drucken");
    }
    if (active === "puzzle") {
      checks.push(puzzle.cols * puzzle.rows <= 120 ? "Teileanzahl bleibt handhabbar" : "Sehr viele Teile können filigran werden");
      checks.push("Kerf muss im Laser-/CNC-Programm final angepasst werden");
      checks.push("SVG nach Import im Zielprogramm auf echte Millimeter prüfen");
    }
    if (active === "paint") {
      checks.push(paint.colors <= 8 ? "Farbgruppen bleiben uebersichtlich" : "Viele Farben können den Plan unruhig machen");
      checks.push("Originalbild zusätzlich im Projekt speichern");
      checks.push("Plan als Bemalhilfe, nicht als verbindliche Farbkalibrierung nutzen");
    }
    if (active === "qr") {
      checks.push(qr.mode === "wifi" ? (qr.ssid.trim() ? "SSID ist gesetzt" : "SSID fehlt") : (qr.text.trim() ? "QR-Inhalt ist gesetzt" : "Text oder Link fehlt"));
      checks.push(qr.correction === "H" || qr.correction === "Q" ? "Fehlerkorrektur ist gut für gedruckte Labels" : "Fuer Aufkleber besser Q oder H nutzen");
      checks.push(qr.size >= 512 ? "PNG-Aufloesung ist ausreichend" : "Fuer Druck besser mindestens 512 px Exportgröße");
    }
    return checks;
  }, [active, box, litho, paint.colors, puzzle, qr, routePoints.length, routeSettings, splitpin, tolerance]);
  const preview = useMemo<ToolPreview>(() => {
    if (active === "route") {
      const heights = makeRouteHeights(routePoints, routeSettings.grid, routeSettings.relief, routeSettings.routeWidth);
      return {
        kind: "stl",
        title: "Route Relief Vorschau",
        content: stlFromHeightField("route-relief", heights, routeSettings.size, routeSettings.size, routeSettings.base),
        stats: [`${routePoints.length} Trackpunkte`, `${stats.distance.toFixed(1)} km`, `${Math.round(stats.gain)} m Anstieg`],
      };
    }
    if (active === "lithophane") {
      return {
        kind: "stl",
        title: "Lithophane Vorschau",
        content: makeLithophaneStl(litho.image, litho.width, litho.height, litho.min, litho.max, litho.grid, litho.frame),
        stats: [`${litho.width} x ${litho.height} mm`, `${litho.min}-${litho.max} mm Stärke`, `${litho.frame} mm Rahmen`],
      };
    }
    if (active === "tolerance") {
      return {
        kind: "stl",
        title: "Toleranz-Kit Vorschau",
        content: makeToleranceModel(tolerance.nominal, tolerance.start, tolerance.step, tolerance.count, tolerance.height),
        stats: [`${tolerance.count} Messpunkte`, `${(tolerance.nominal + tolerance.start).toFixed(2)}-${(tolerance.nominal + tolerance.start + tolerance.step * (tolerance.count - 1)).toFixed(2)} mm`, "Pins + Socket-Ringe"],
      };
    }
    if (active === "box") {
      return {
        kind: "stl",
        title: "Box-Kit Vorschau",
        content: makeBoxModel(box.width, box.depth, box.height, box.wall, box.bottom, box.dividersX, box.dividersY, box.lidClearance),
        stats: [`${box.width} x ${box.depth} x ${box.height} mm`, `${box.dividersX + box.dividersY} Teiler`, `${box.lidClearance} mm Deckelspiel`],
      };
    }
    if (active === "splitpin") {
      return {
        kind: "stl",
        title: "Split & Pin Vorschau",
        content: makeSplitPinModel(splitpin.width, splitpin.depth, splitpin.height, splitpin.gap, splitpin.pins, splitpin.pinDiameter, splitpin.pinLength, splitpin.clearance),
        stats: [`${splitpin.pins} Pins`, `${splitpin.pinDiameter} mm Durchmesser`, `${splitpin.clearance} mm Socket-Spiel`],
      };
    }
    if (active === "puzzle") {
      return {
        kind: "svg",
        title: "Puzzle-Schneidvorlage",
        content: makePuzzleSvg(puzzle.width, puzzle.height, puzzle.cols, puzzle.rows, puzzle.knob, puzzle.imageData),
        stats: [`${puzzle.cols * puzzle.rows} Teile`, `${puzzle.width} x ${puzzle.height} mm`, "SVG Export"],
      };
    }
    if (active === "qr") {
      return {
        kind: "svg",
        title: "QR Code Vorschau",
        content: qrCodeSvg || `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#fff"/><text x="160" y="160" text-anchor="middle" fill="#0b1424" font-size="16">QR wird erzeugt...</text></svg>`,
        stats: [qr.mode === "wifi" ? `WLAN: ${qr.ssid || "ohne SSID"}` : "Text/Link", `ECC ${qr.correction}`, `${qr.size}px Export`],
      };
    }
    return { kind: "paint", title: "Bemalplan Vorschau", stats: [`${paint.colors} Farbgruppen`, "PNG Export", "Palette reduziert"] };
  }, [active, box, litho, paint.colors, puzzle, qr, qrCodeSvg, routePoints, routeSettings, splitpin, stats.distance, stats.gain, tolerance]);

  useEffect(() => {
    if (active === "paint") drawPaintPlan(paintCanvasRef.current, paint.image, paint.colors);
  }, [active, paint]);

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      if (active !== "qr") return;
      try {
        const svg = await qrSvg(qrPayload(qr), qr);
        if (!cancelled) setQrCodeSvg(svg);
      } catch (error) {
        if (!cancelled) setQrCodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#fff"/><text x="160" y="150" text-anchor="middle" fill="#b91c1c" font-size="15">QR konnte nicht erzeugt werden.</text><text x="160" y="174" text-anchor="middle" fill="#64748b" font-size="11">${escapeXml(String(error))}</text></svg>`);
      }
    }
    void renderQr();
    return () => { cancelled = true; };
  }, [active, qr]);

  async function importGpx(file: File) {
    const text = await file.text();
    const parsed = parseGpx(text);
    if (parsed.length < 2) {
      setStatus("Die GPX-Datei enthaelt keinen nutzbaren Track.");
      return;
    }
    setRoutePoints(parsed);
    setStatus(`${parsed.length} GPX-Punkte geladen.`);
  }

  function applyPreset(index: number) {
    if (active === "route") {
      const presets = [
        { size: 120, base: 2.8, relief: 16, routeWidth: 9, grid: 44 },
        { size: 180, base: 3.2, relief: 28, routeWidth: 7, grid: 58 },
        { size: 80, base: 2.2, relief: 10, routeWidth: 6, grid: 32 },
      ];
      setRouteSettings(presets[index] ?? presets[0]);
    }
    if (active === "lithophane") {
      const presets = [
        { width: 120, height: 80, min: 0.8, max: 3.2, grid: 48, frame: 4 },
        { width: 80, height: 80, min: 0.9, max: 3.8, grid: 44, frame: 6 },
        { width: 140, height: 95, min: 0.65, max: 3.4, grid: 64, frame: 3 },
      ];
      setLitho((current) => ({ ...current, ...(presets[index] ?? presets[0]) }));
    }
    if (active === "tolerance") {
      const presets = [
        { nominal: 10, start: -0.25, step: 0.1, count: 7, height: 10 },
        { nominal: 10, start: -0.15, step: 0.05, count: 9, height: 10 },
        { nominal: 8, start: -0.3, step: 0.15, count: 5, height: 8 },
      ];
      setTolerance(presets[index] ?? presets[0]);
    }
    if (active === "box") {
      const presets = [
        { width: 90, depth: 60, height: 36, wall: 2.4, bottom: 2.8, dividersX: 1, dividersY: 0, lidClearance: 0.35 },
        { width: 120, depth: 80, height: 42, wall: 2.6, bottom: 3, dividersX: 2, dividersY: 1, lidClearance: 0.4 },
        { width: 140, depth: 55, height: 24, wall: 2.2, bottom: 2.4, dividersX: 3, dividersY: 0, lidClearance: 0.32 },
      ];
      setBox(presets[index] ?? presets[0]);
    }
    if (active === "splitpin") {
      const presets = [
        { width: 120, depth: 70, height: 20, gap: 7, pins: 3, pinDiameter: 6, pinLength: 18, clearance: 0.25 },
        { width: 70, depth: 42, height: 12, gap: 4, pins: 3, pinDiameter: 3, pinLength: 9, clearance: 0.12 },
        { width: 140, depth: 80, height: 18, gap: 5, pins: 4, pinDiameter: 5, pinLength: 22, clearance: 0.18 },
      ];
      setSplitpin(presets[index] ?? presets[0]);
    }
    if (active === "puzzle") {
      const presets = [
        { width: 180, height: 120, cols: 6, rows: 4, knob: 0.26 },
        { width: 160, height: 110, cols: 4, rows: 3, knob: 0.28 },
        { width: 240, height: 160, cols: 10, rows: 7, knob: 0.22 },
      ];
      setPuzzle((current) => ({ ...current, ...(presets[index] ?? presets[0]) }));
    }
    if (active === "paint") {
      setPaint((current) => ({ ...current, colors: [6, 4, 11][index] ?? 6 }));
    }
    if (active === "qr") {
      const presets = [
        { mode: "text" as const, text: "https://makershelf.pache.cloud", label: "makershelf", correction: "H" as const, size: 768, margin: 4 },
        { mode: "wifi" as const, ssid: "Guest WiFi", password: "ChangeMe123!", encryption: "WPA" as const, label: "Guest WiFi", correction: "Q" as const, size: 768, margin: 4 },
        { mode: "text" as const, text: "MAKERSHELF-ASSET-0001", label: "MAKERSHELF-ASSET-0001", correction: "M" as const, size: 512, margin: 3 },
      ];
      setQr((current) => ({ ...current, ...(presets[index] ?? presets[0]) }));
    }
    setStatus(`${activeTool.presets[index]?.label ?? "Preset"} angewendet.`);
  }

  async function exportActive() {
    const startExport = async (baseName: string, primary: GeneratedAsset[], parameters: Record<string, unknown>, notes: string[]) => {
      await downloadZip(`${safeName(baseName)}.zip`, packagedAssets(activeTool.title, parameters, notes, primary));
      setStatus(`${activeTool.title}: Projektpaket mit ${primary.length + 2} Dateien erzeugt.`);
    };

    if (active === "route") {
      const heights = makeRouteHeights(routePoints, routeSettings.grid, routeSettings.relief, routeSettings.routeWidth);
      await startExport(
        "makershelf-route-relief",
        [{ filename: "route-relief.stl", content: stlFromHeightField("route-relief", heights, routeSettings.size, routeSettings.size, routeSettings.base), type: "model/stl" }],
        { ...routeSettings, points: routePoints.length, distanceKm: Number(stats.distance.toFixed(2)), elevationGainM: Math.round(stats.gain) },
        ["Relief ist watertight und besitzt Seitenwände sowie Unterseite.", "Vor dem Druck im Slicer auf gewünschte Größe prüfen."],
      );
    }
    if (active === "lithophane") {
      await startExport(
        `${safeName(litho.name)}-lithophane`,
        [{ filename: `${safeName(litho.name)}.stl`, content: makeLithophaneStl(litho.image, litho.width, litho.height, litho.min, litho.max, litho.grid, litho.frame), type: "model/stl" }],
        { width: litho.width, height: litho.height, minThickness: litho.min, maxThickness: litho.max, frame: litho.frame, grid: litho.grid },
        ["Helle Bildbereiche werden dünner, dunkle Bildbereiche stärker gedruckt.", "Für PLA meist 0.12 bis 0.2 mm Layerhöhe testen."],
      );
    }
    if (active === "tolerance") {
      await startExport(
        "makershelf-tolerance-test",
        [
          { filename: "tolerance-pin-socket-kit.stl", content: makeToleranceModel(tolerance.nominal, tolerance.start, tolerance.step, tolerance.count, tolerance.height), type: "model/stl" },
          { filename: "calibration-log.csv", content: toleranceCsv(tolerance.nominal, tolerance.start, tolerance.step, tolerance.count), type: "text/csv" },
        ],
        tolerance,
        ["Das Kit enthaelt Pin-Gauges und Socket-Ringe statt nur symbolischer Kloetze.", "Nach dem Druck passende Kombination markieren und als Druckerprofil-Referenz nutzen."],
      );
    }
    if (active === "box") {
      await startExport(
        "makershelf-box-kit",
        [
          { filename: "box-with-lid-and-dividers.stl", content: makeBoxModel(box.width, box.depth, box.height, box.wall, box.bottom, box.dividersX, box.dividersY, box.lidClearance), type: "model/stl" },
          { filename: "editable-box.scad", content: boxOpenScad(box), type: "text/plain" },
        ],
        box,
        ["Box und Deckel liegen in einer STL nebeneinander.", "Bei sehr engen Druckern Lid-Clearance leicht erhöhen."],
      );
    }
    if (active === "splitpin") {
      await startExport(
        "makershelf-split-pin-kit",
        [
          { filename: "split-pin-socket-kit.stl", content: makeSplitPinModel(splitpin.width, splitpin.depth, splitpin.height, splitpin.gap, splitpin.pins, splitpin.pinDiameter, splitpin.pinLength, splitpin.clearance), type: "model/stl" },
          { filename: "editable-split-pin-kit.scad", content: splitPinOpenScad(splitpin), type: "text/plain" },
        ],
        splitpin,
        ["Erzeugt Orientierungshaelften, Pins und Socket-Gauges als druckbare Planungshilfe.", "Das ersetzt keinen echten CAD-Schnitt, hilft aber beim Festlegen von Pin-Durchmesser und Spiel."],
      );
    }
    if (active === "puzzle") {
      await startExport(
        "makershelf-puzzle-template",
        [{ filename: "puzzle-template.svg", content: makePuzzleSvg(puzzle.width, puzzle.height, puzzle.cols, puzzle.rows, puzzle.knob, puzzle.imageData), type: "image/svg+xml" }],
        { width: puzzle.width, height: puzzle.height, cols: puzzle.cols, rows: puzzle.rows, knob: puzzle.knob },
        ["SVG kann als Laser-/CNC-Vorlage oder als Druckvorlage genutzt werden.", "Linienstarke vor der Fertigung passend zum Werkzeug einstellen."],
      );
    }
    if (active === "qr") {
      const payload = qrPayload(qr);
      const svg = qrCodeSvg || await qrSvg(payload, qr);
      const labelSvg = await printableQrLabelSvg(payload, qr, qr.label);
      const png = await qrPngBlob(payload, qr);
      await startExport(
        `${safeName(qr.label || (qr.mode === "wifi" ? qr.ssid : "qr-code"))}-qr-code`,
        [
          { filename: "qr-code.svg", content: svg, type: "image/svg+xml" },
          { filename: "qr-print-label.svg", content: labelSvg, type: "image/svg+xml" },
          { filename: "qr-code.png", content: png, type: "image/png" },
          { filename: "payload.txt", content: payload, type: "text/plain" },
        ],
        { ...qr, payload: qr.mode === "wifi" ? "WIFI:*masked*" : payload, password: qr.password ? "***" : "" },
        ["SVG ist für sauberen Druck skalierbar.", "PNG ist für schnelle Nutzung und Etiketten-Tools enthalten.", "WLAN-QR bitte nach dem Druck mit Android und iOS testen."],
      );
    }
    if (active === "paint") {
      const png = await canvasToBlob(paintCanvasRef.current);
      await startExport(
        `${safeName(paint.name)}-paint-plan`,
        [{ filename: `${safeName(paint.name)}.png`, content: png, type: "image/png" }],
        { colors: paint.colors, sourceName: paint.name },
        ["PNG enthaelt reduzierte Farbgruppen als schnellen Bemalplan.", "Fuer feine Miniaturen danach manuell Highlights/Schatten ergaenzen."],
      );
    }
  }

  if (!devEnabled) {
    return (
      <div className="space-y-8">
        <section className="hero-card">
          <p className="eyebrow">Experiment deaktiviert</p>
          <h1>Workshop Tools sind ausgeblendet</h1>
          <p className="mt-3 max-w-3xl text-muted">
            Diese unfertigen Werkzeuge sind nicht Teil der normalen Release-Oberflaeche. Aktiviere sie bei Bedarf im
            versteckten DEV-Bereich.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" href="/dev">DEV-Bereich öffnen</Link>
            <Link className="btn-secondary" href="/projects">Zur Projektbibliothek</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="hero-card tools-hero">
        <p className="eyebrow">Werkzeuge</p>
        <h1>Workshop Tools</h1>
        <p>
          Eine echte Maker-Werkbank in makershelf: Presets, Live-Vorschau, Qualitaetschecks,
          Druckhinweise und Exportpakete mit MakershelfInfo statt reiner Demo-Slider.
        </p>
      </section>

      <section className="mobile-tools-hub panel p-4">
        <p className="eyebrow">{text(settings.language, "Schnellzugriff", "Quick access")}</p>
        <h2 className="mt-1 text-xl font-bold">{text(settings.language, "Werkzeuge & Verwaltung", "Tools & management")}</h2>
        <p className="mt-2 text-sm text-muted">
          {text(settings.language, "Die wichtigsten Zusatzbereiche liegen mobil hier, damit die untere Navigation ruhig und schnell bedienbar bleibt.", "The most important sections are here on mobile so the bottom navigation stays clean and fast.")}
        </p>
        <div className="mt-4 grid gap-3">
          <Link href="/indexing" className="mobile-tools-hub-card">
            <span>{text(settings.language, "Indexierung", "Indexing")}</span>
            <small>{text(settings.language, "Import-Ordner, Projektstruktur und Batch-Import", "Import folders, project structure and batch import")}</small>
          </Link>
          <Link href="/duplicates" className="mobile-tools-hub-card">
            <span>{text(settings.language, "Duplikate", "Duplicates")}</span>
            <small>{text(settings.language, "Doppelte Dateien finden, prüfen und bereinigen", "Find, review and remove duplicate files")}</small>
          </Link>
          {settings.filamentVaultEnabled && (
            <Link href="/filament" className="mobile-tools-hub-card">
              <span>Filament Vault</span>
              <small>{text(settings.language, "Pro-Person-Bestand, Team Share, Orte und Verbrauch", "Per-person stock, team share, locations and usage")}</small>
            </Link>
          )}
        </div>
      </section>

      <section className="tools-layout">
        <aside className="panel p-4 tools-toolbox">
          <div className="tools-workflow-intro mb-4 rounded-2xl bg-primary/10 p-4">
            <p className="eyebrow">Workflow</p>
            <p className="mt-2 text-sm text-muted">
              Werkzeug wählen, Preset starten, Parameter feinjustieren, Vorschau prüfen und als makershelf-Projektpaket exportieren.
            </p>
          </div>
          <div className="tools-picker">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={`rounded-2xl border p-4 text-left transition ${active === tool.id ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/60"}`}
                onClick={() => setActive(tool.id)}
              >
                <span className="eyebrow text-xs">{tool.category}</span>
                <strong className="mt-1 block text-lg">{tool.title}</strong>
                <span className="mt-1 block text-xs font-semibold text-primary">{tool.kicker}</span>
                <span className="mt-2 block text-sm text-muted">{tool.promise}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel p-6 tools-workbench">
          <div className="tools-workbench-header flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{activeTool.category} · {activeTool.kicker}</p>
              <h2 className="text-3xl font-bold">{activeTool.title}</h2>
              <p className="mt-2 max-w-3xl text-muted">{activeTool.description}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void exportActive()}>{activeTool.exportLabel}</button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {toolMetrics.map((metric) => (
              <ToolMetric key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {activeTool.presets.map((preset, index) => (
              <button
                key={preset.label}
                type="button"
                className="rounded-2xl border border-border bg-card/50 p-4 text-left transition hover:border-primary"
                onClick={() => applyPreset(index)}
              >
                <span className="text-sm font-black">{preset.label}</span>
                <span className="mt-1 block text-sm text-muted">{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="responsive-split mt-6 tools-workbench-grid">
            <div className="section-shell p-5 tools-controls-pane">
              <div className="mb-5">
                <p className="eyebrow">Parameter</p>
                <p className="mt-2 text-sm text-muted">{activeTool.promise}</p>
              </div>
              {active === "route" && (
                <div className="grid gap-4">
                  <FileInput label="GPX-Datei laden" accept=".gpx,application/gpx+xml,text/xml" onFile={importGpx} />
                  <NumberControl label="Plattengröße" value={routeSettings.size} min={60} max={220} step={5} unit="mm" onChange={(size) => setRouteSettings((s) => ({ ...s, size }))} />
                  <NumberControl label="Basis" value={routeSettings.base} min={1} max={8} step={0.2} unit="mm" onChange={(base) => setRouteSettings((s) => ({ ...s, base }))} />
                  <NumberControl label="Reliefhöhe" value={routeSettings.relief} min={4} max={40} step={1} unit="mm" onChange={(relief) => setRouteSettings((s) => ({ ...s, relief }))} />
                  <NumberControl label="Routenbreite" value={routeSettings.routeWidth} min={3} max={18} step={1} onChange={(routeWidth) => setRouteSettings((s) => ({ ...s, routeWidth }))} />
                </div>
              )}

              {active === "lithophane" && (
                <div className="grid gap-4">
                  <FileInput label="Bild laden" accept="image/*" onFile={(file) => loadImageFile(file, (image, _dataUrl, name) => setLitho((s) => ({ ...s, image, name })))} />
                  <NumberControl label="Breite" value={litho.width} min={40} max={220} step={5} unit="mm" onChange={(width) => setLitho((s) => ({ ...s, width }))} />
                  <NumberControl label="Höhe" value={litho.height} min={40} max={180} step={5} unit="mm" onChange={(height) => setLitho((s) => ({ ...s, height }))} />
                  <NumberControl label="Min. Stärke" value={litho.min} min={0.4} max={2} step={0.1} unit="mm" onChange={(min) => setLitho((s) => ({ ...s, min }))} />
                  <NumberControl label="Max. Stärke" value={litho.max} min={1.2} max={6} step={0.1} unit="mm" onChange={(max) => setLitho((s) => ({ ...s, max }))} />
                  <NumberControl label="Rahmen" value={litho.frame} min={0} max={12} step={0.5} unit="mm" onChange={(frame) => setLitho((s) => ({ ...s, frame }))} />
                </div>
              )}

              {active === "tolerance" && (
                <div className="grid gap-4">
                  <NumberControl label="Nominalmaß" value={tolerance.nominal} min={4} max={30} step={0.5} unit="mm" onChange={(nominal) => setTolerance((s) => ({ ...s, nominal }))} />
                  <NumberControl label="Start-Abweichung" value={tolerance.start} min={-1} max={1} step={0.05} unit="mm" onChange={(start) => setTolerance((s) => ({ ...s, start }))} />
                  <NumberControl label="Schrittweite" value={tolerance.step} min={0.02} max={0.5} step={0.01} unit="mm" onChange={(step) => setTolerance((s) => ({ ...s, step }))} />
                  <NumberControl label="Anzahl" value={tolerance.count} min={3} max={12} step={1} onChange={(count) => setTolerance((s) => ({ ...s, count }))} />
                </div>
              )}

              {active === "box" && (
                <div className="grid gap-4">
                  <NumberControl label="Breite" value={box.width} min={30} max={220} step={5} unit="mm" onChange={(width) => setBox((s) => ({ ...s, width }))} />
                  <NumberControl label="Tiefe" value={box.depth} min={30} max={180} step={5} unit="mm" onChange={(depth) => setBox((s) => ({ ...s, depth }))} />
                  <NumberControl label="Höhe" value={box.height} min={12} max={120} step={2} unit="mm" onChange={(height) => setBox((s) => ({ ...s, height }))} />
                  <NumberControl label="Wandstärke" value={box.wall} min={1} max={6} step={0.2} unit="mm" onChange={(wall) => setBox((s) => ({ ...s, wall }))} />
                  <NumberControl label="Teiler quer" value={box.dividersX} min={0} max={6} step={1} onChange={(dividersX) => setBox((s) => ({ ...s, dividersX }))} />
                  <NumberControl label="Teiler laengs" value={box.dividersY} min={0} max={6} step={1} onChange={(dividersY) => setBox((s) => ({ ...s, dividersY }))} />
                  <NumberControl label="Deckelspiel" value={box.lidClearance} min={0.1} max={1.2} step={0.05} unit="mm" onChange={(lidClearance) => setBox((s) => ({ ...s, lidClearance }))} />
                </div>
              )}

              {active === "splitpin" && (
                <div className="grid gap-4">
                  <NumberControl label="Modellbreite" value={splitpin.width} min={50} max={260} step={5} unit="mm" onChange={(width) => setSplitpin((s) => ({ ...s, width }))} />
                  <NumberControl label="Schnittspalt" value={splitpin.gap} min={2} max={20} step={1} unit="mm" onChange={(gap) => setSplitpin((s) => ({ ...s, gap }))} />
                  <NumberControl label="Passstifte" value={splitpin.pins} min={1} max={8} step={1} onChange={(pins) => setSplitpin((s) => ({ ...s, pins }))} />
                  <NumberControl label="Stiftdurchmesser" value={splitpin.pinDiameter} min={2} max={14} step={0.5} unit="mm" onChange={(pinDiameter) => setSplitpin((s) => ({ ...s, pinDiameter }))} />
                  <NumberControl label="Socket-Spiel" value={splitpin.clearance} min={0.05} max={1} step={0.05} unit="mm" onChange={(clearance) => setSplitpin((s) => ({ ...s, clearance }))} />
                </div>
              )}

              {active === "puzzle" && (
                <div className="grid gap-4">
                  <FileInput label="Bild laden" accept="image/*" onFile={(file) => loadImageFile(file, (_image, imageData) => setPuzzle((s) => ({ ...s, imageData })))} />
                  <NumberControl label="Breite" value={puzzle.width} min={80} max={320} step={5} unit="mm" onChange={(width) => setPuzzle((s) => ({ ...s, width }))} />
                  <NumberControl label="Spalten" value={puzzle.cols} min={2} max={16} step={1} onChange={(cols) => setPuzzle((s) => ({ ...s, cols }))} />
                  <NumberControl label="Reihen" value={puzzle.rows} min={2} max={12} step={1} onChange={(rows) => setPuzzle((s) => ({ ...s, rows }))} />
                </div>
              )}

              {active === "paint" && (
                <div className="grid gap-4">
                  <FileInput label="Bild laden" accept="image/*" onFile={(file) => loadImageFile(file, (image, _dataUrl, name) => setPaint((s) => ({ ...s, image, name })))} />
                  <NumberControl label="Farbgruppen" value={paint.colors} min={3} max={12} step={1} onChange={(colors) => setPaint((s) => ({ ...s, colors }))} />
                </div>
              )}

              {active === "qr" && (
                <div className="grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">QR-Typ</span>
                    <select className="field" value={qr.mode} onChange={(event) => setQr((s) => ({ ...s, mode: event.target.value as "text" | "wifi" }))}>
                      <option value="text">Text oder Link</option>
                      <option value="wifi">WLAN-Zugang</option>
                    </select>
                  </label>

                  {qr.mode === "text" ? (
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Inhalt</span>
                      <textarea
                        className="field min-h-28"
                        value={qr.text}
                        placeholder="https://..., Projekt-ID, Hinweistext"
                        onChange={(event) => setQr((s) => ({ ...s, text: event.target.value }))}
                      />
                    </label>
                  ) : (
                    <div className="grid gap-4">
                      <label className="grid gap-2">
                        <span className="text-sm font-semibold">WLAN-Name (SSID)</span>
                        <input className="field" value={qr.ssid} onChange={(event) => setQr((s) => ({ ...s, ssid: event.target.value }))} />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-semibold">Passwort</span>
                        <input className="field" value={qr.password} type="text" disabled={qr.encryption === "nopass"} onChange={(event) => setQr((s) => ({ ...s, password: event.target.value }))} />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Verschluesselung</span>
                          <select className="field" value={qr.encryption} onChange={(event) => setQr((s) => ({ ...s, encryption: event.target.value as "WPA" | "WEP" | "nopass" }))}>
                            <option value="WPA">WPA/WPA2/WPA3</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">Ohne Passwort</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 text-sm font-semibold">
                          <input type="checkbox" checked={qr.hidden} onChange={(event) => setQr((s) => ({ ...s, hidden: event.target.checked }))} />
                          Verstecktes WLAN
                        </label>
                      </div>
                    </div>
                  )}

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Beschriftung</span>
                    <input className="field" value={qr.label} placeholder="Optionaler Text für das Label" onChange={(event) => setQr((s) => ({ ...s, label: event.target.value }))} />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Fehlerkorrektur</span>
                      <select className="field" value={qr.correction} onChange={(event) => setQr((s) => ({ ...s, correction: event.target.value as "L" | "M" | "Q" | "H" }))}>
                        <option value="M">M - Standard</option>
                        <option value="Q">Q - Label</option>
                        <option value="H">H - robust</option>
                        <option value="L">L - maximale Dichte</option>
                      </select>
                    </label>
                    <NumberControl label="PNG-Größe" value={qr.size} min={256} max={1600} step={128} unit="px" onChange={(size) => setQr((s) => ({ ...s, size }))} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Code-Farbe</span>
                      <input className="field h-12 p-1" type="color" value={qr.dark} onChange={(event) => setQr((s) => ({ ...s, dark: event.target.value }))} />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Hintergrund</span>
                      <input className="field h-12 p-1" type="color" value={qr.light} onChange={(event) => setQr((s) => ({ ...s, light: event.target.value }))} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="section-shell p-5 tools-preview-pane">
              <div className="tools-preview-card rounded-3xl border border-border bg-slate-950/40 p-4">
                {preview.kind === "stl" && <StlWorkbenchViewer stl={preview.content} title={preview.title} />}
                {preview.kind === "svg" && (
                  <div className="grid min-h-[420px] place-items-center rounded-2xl border border-border bg-slate-950/60 p-4">
                    <div className="max-w-full overflow-auto" dangerouslySetInnerHTML={{ __html: preview.content }} />
                  </div>
                )}
                {preview.kind === "paint" && <canvas ref={paintCanvasRef} className="h-auto w-full rounded-2xl border border-border" />}
                <div className="mt-3 flex flex-wrap gap-2">
                  {preview.stats.map((item) => (
                    <span key={item} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted">{item}</span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl bg-card/50 p-4 text-sm text-muted">
                {active === "route" && <p>{routePoints.length} Trackpunkte, {stats.distance.toFixed(1)} km, {Math.round(stats.gain)} m Anstieg.</p>}
                {active === "lithophane" && <p>Exportiert ein druckbares Relief mit {litho.min} bis {litho.max} mm Materialstärke.</p>}
                {active === "tolerance" && <p>Läuft von {(tolerance.nominal + tolerance.start).toFixed(2)} mm bis {(tolerance.nominal + tolerance.start + tolerance.step * (tolerance.count - 1)).toFixed(2)} mm.</p>}
                {active === "box" && <p>Offene Box: {box.width} x {box.depth} x {box.height} mm, Wand {box.wall} mm, {box.dividersX + box.dividersY} Teiler und separater Deckel.</p>}
                {active === "splitpin" && <p>Erzeugt ein Pin-/Socket-Testkit mit {splitpin.pins} Passstiften und {splitpin.clearance.toFixed(2)} mm Socket-Spiel.</p>}
                {active === "puzzle" && <p>SVG-Vorlage mit {puzzle.cols * puzzle.rows} Teilen. Fuer Laser/CNC oder als Druckvorlage geeignet.</p>}
                {active === "paint" && <p>PNG-Farbplan mit reduzierten Farbgruppen für Bemalung und Dokumentation.</p>}
                {active === "qr" && <p>{qr.mode === "wifi" ? `WLAN-QR für ${qr.ssid || "unbenannte SSID"}.` : "Druckbarer Text-/Link-QR."} Exportiert SVG, PNG und Payload-Datei.</p>}
                <p>Export: Jede Ausgabe kommt als ZIP mit Modell/Vorlage, MakershelfInfo.json und README.txt.</p>
                <p>Status: {escapeXml(status)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <ToolInfoCard title="So nutzt du das Tool" items={activeTool.workflow} />
            <ToolInfoCard title="Export enthaelt" items={activeTool.outputs} />
            <ToolInfoCard title="Qualitaetscheck" items={qualityChecks} />
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card/40 p-4">
            <p className="eyebrow">Drucknotizen</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeTool.printTips.map((tip) => (
                <span key={tip} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">{tip}</span>
              ))}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
