"use client";

import { useEffect, useRef, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import type { Language, PrintFile } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";

type ThreeDViewerProps = {
  file?: PrintFile;
  language?: Language;
  getFileObjectUrlOverride?: (file: PrintFile) => Promise<string> | string;
  previewLimitMb?: number;
};

type StepSummary = {
  description: string;
  fileName: string;
  schema: string;
  product: string;
  entityCount: number;
  points: number;
  faces: number;
  solids: number;
  previewPoints: [number, number, number][];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  } | null;
};

type ViewerError = {
  title: string;
  detail: string;
};

type StlTriangle = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

const renderableTypes = new Set<PrintFile["type"]>(["STL", "OBJ", "3MF", "GCODE"]);
const STL_FALLBACK_MAX_TRIANGLES = 18000;
const STEP_PREVIEW_MAX_POINTS = 24000;
const stepNumberPattern = "[-+]?\\d*\\.?\\d+(?:[Ee][-+]?\\d+)?";

function extractStepValue(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  return match?.[1]?.trim().replace(/^'+|'+$/g, "") || "";
}

function parseStepSummary(content: string): StepSummary {
  const normalized = content.replace(/\s+/g, " ");
  const productMatch = [...content.matchAll(/PRODUCT\s*\(\s*'([^']+)'/gi)].find(
    (entry) => entry[1]?.trim(),
  );
  const previewPoints = parseStepPreviewPoints(content);
  const bounds = previewPoints.length ? getPointBounds(previewPoints) : null;

  return {
    description: extractStepValue(normalized, /FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'/i),
    fileName: extractStepValue(normalized, /FILE_NAME\s*\(\s*'([^']*)'/i),
    schema: extractStepValue(normalized, /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i),
    product: productMatch?.[1]?.trim() || "",
    entityCount: (content.match(/#[0-9]+\s*=/g) || []).length,
    points: (content.match(/CARTESIAN_POINT/gi) || []).length,
    faces: (content.match(/ADVANCED_FACE/gi) || []).length,
    solids: (content.match(/MANIFOLD_SOLID_BREP|CLOSED_SHELL/gi) || []).length,
    previewPoints,
    bounds,
  };
}

function parseStepPreviewPoints(content: string) {
  const points: [number, number, number][] = [];
  const matcher = new RegExp(
    `CARTESIAN_POINT\\s*\\([^,]*,\\s*\\(\\s*(${stepNumberPattern})\\s*,\\s*(${stepNumberPattern})\\s*,\\s*(${stepNumberPattern})\\s*\\)`,
    "gi",
  );
  const allMatches = [...content.matchAll(matcher)];
  const stride = Math.max(1, Math.ceil(allMatches.length / STEP_PREVIEW_MAX_POINTS));

  for (let index = 0; index < allMatches.length; index += stride) {
    const match = allMatches[index];
    const point: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (point.every(Number.isFinite)) {
      points.push(point);
    }
  }

  return points;
}

function getPointBounds(points: [number, number, number][]) {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const point of points) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }

  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as [number, number, number],
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function getViewerError(error: unknown, language: Language): ViewerError {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (!(error instanceof Error)) {
    return {
      title: text(
        language,
        "3D-Vorschau konnte nicht geladen werden.",
        "3D preview could not be loaded.",
      ),
      detail: text(
        language,
        "Der Browser hat keinen verwertbaren Fehlertext zurückgegeben.",
        "The browser did not return a usable error message.",
      ),
    };
  }

  if (normalized.includes("webgl")) {
    return {
      title: text(
        language,
        "WebGL ist in diesem Browser nicht verfügbar.",
        "WebGL is not available in this browser.",
      ),
      detail: text(
        language,
        "Bitte Hardwarebeschleunigung im Browser aktivieren oder einen aktuellen Chrome/Edge/Firefox verwenden.",
        "Please enable browser hardware acceleration or use a current Chrome, Edge, or Firefox.",
      ),
    };
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("datei konnte nicht") ||
    normalized.includes("http ")
  ) {
    return {
      title: text(
        language,
        "Die Datei konnte nicht aus makershelf geladen werden.",
        "The file could not be loaded from makershelf.",
      ),
      detail: message,
    };
  }

  if (
    normalized.includes("dataview") ||
    normalized.includes("offset is outside the bounds") ||
    normalized.includes("unexpected eof") ||
    normalized.includes("invalid") ||
    normalized.includes("unexpected token")
  ) {
    return {
      title: text(
        language,
        "Die Datei enthält keine gültigen 3D-Geometriedaten für die Live-Vorschau.",
        "The file does not contain valid 3D geometry for the live preview.",
      ),
      detail: message,
    };
  }

  if (
    normalized.includes("out of memory") ||
    normalized.includes("allocation") ||
    normalized.includes("array buffer")
  ) {
    return {
      title: text(
        language,
        "Die Datei ist für die Browser-Vorschau zu groß.",
        "The file is too large for browser preview.",
      ),
      detail: message,
    };
  }

  return {
    title: text(
      language,
      "3D-Vorschau konnte nicht geladen werden.",
      "3D preview could not be loaded.",
    ),
    detail: message || text(language, "Unbekannter Fehler.", "Unknown error."),
  };
}

function assertWebGlAvailable() {
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2") ||
    canvas.getContext("webgl") ||
    canvas.getContext("experimental-webgl");

  if (!gl) {
    throw new Error("WebGL ist deaktiviert oder wird von diesem Browser/Gerät nicht unterstützt.");
  }
}

async function fetchObjectArrayBuffer(objectUrl: string) {
  const response = await fetch(objectUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Datei konnte nicht geladen werden.`);
  }
  return response.arrayBuffer();
}

async function fetchObjectText(objectUrl: string) {
  const response = await fetch(objectUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Datei konnte nicht geladen werden.`);
  }
  return response.text();
}

function looksLikeBinaryStl(view: DataView) {
  if (view.byteLength < 84) {
    return false;
  }

  const triangleCount = view.getUint32(80, true);
  return 84 + triangleCount * 50 <= view.byteLength;
}

function parseBinaryStlTriangles(buffer: ArrayBuffer): StlTriangle[] {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const stride = Math.max(1, Math.ceil(triangleCount / STL_FALLBACK_MAX_TRIANGLES));
  const triangles: StlTriangle[] = [];

  for (let index = 0; index < triangleCount; index += stride) {
    const offset = 84 + index * 50 + 12;
    triangles.push([
      [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)],
      [view.getFloat32(offset + 12, true), view.getFloat32(offset + 16, true), view.getFloat32(offset + 20, true)],
      [view.getFloat32(offset + 24, true), view.getFloat32(offset + 28, true), view.getFloat32(offset + 32, true)],
    ]);
  }

  return triangles;
}

function parseAsciiStlTriangles(content: string): StlTriangle[] {
  const vertices = [...content.matchAll(/vertex\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi)].map(
    (match) => [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number],
  );
  const triangleCount = Math.floor(vertices.length / 3);
  const stride = Math.max(1, Math.ceil(triangleCount / STL_FALLBACK_MAX_TRIANGLES));
  const triangles: StlTriangle[] = [];

  for (let index = 0; index < triangleCount; index += stride) {
    const vertexIndex = index * 3;
    triangles.push([
      vertices[vertexIndex],
      vertices[vertexIndex + 1],
      vertices[vertexIndex + 2],
    ]);
  }

  return triangles;
}

function parseStlTriangles(buffer: ArrayBuffer): StlTriangle[] {
  const view = new DataView(buffer);
  if (looksLikeBinaryStl(view)) {
    return parseBinaryStlTriangles(buffer);
  }

  const content = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  return parseAsciiStlTriangles(content);
}

function projectIso([x, y, z]: [number, number, number]) {
  return {
    x: (x - z) * 0.866,
    y: -y + (x + z) * 0.32,
  };
}

function renderStepCanvasPreview(host: HTMLDivElement, summary: StepSummary, language: Language) {
  host.innerHTML = "";
  const width = host.clientWidth || 640;
  const height = host.clientHeight || 360;
  const pixelRatio = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(height * pixelRatio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  host.appendChild(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas-2D ist in diesem Browser nicht verfügbar.");
  }

  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "#121720";
  context.fillRect(0, 0, width, height);

  const gradient = context.createRadialGradient(width * 0.52, height * 0.4, 20, width * 0.52, height * 0.42, width * 0.7);
  gradient.addColorStop(0, "rgba(14, 165, 233, 0.18)");
  gradient.addColorStop(0.55, "rgba(249, 115, 22, 0.08)");
  gradient.addColorStop(1, "rgba(2, 6, 23, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  if (!summary.previewPoints.length || !summary.bounds) {
    context.fillStyle = "rgba(226, 232, 240, 0.92)";
    context.font = "600 16px system-ui, sans-serif";
    context.fillText(
      text(language, "Keine STEP-Punkte für eine Vorschau gefunden.", "No STEP points found for preview."),
      24,
      42,
    );
    return;
  }

  const center: [number, number, number] = [
    (summary.bounds.min[0] + summary.bounds.max[0]) / 2,
    (summary.bounds.min[1] + summary.bounds.max[1]) / 2,
    (summary.bounds.min[2] + summary.bounds.max[2]) / 2,
  ];
  const maxSize = Math.max(...summary.bounds.size, 1);
  const normalizedPoints = summary.previewPoints.map((point) => {
    const centered: [number, number, number] = [
      (point[0] - center[0]) / maxSize,
      (point[1] - center[1]) / maxSize,
      (point[2] - center[2]) / maxSize,
    ];
    return projectIso(centered);
  });
  const minX = Math.min(...normalizedPoints.map((point) => point.x));
  const maxX = Math.max(...normalizedPoints.map((point) => point.x));
  const minY = Math.min(...normalizedPoints.map((point) => point.y));
  const maxY = Math.max(...normalizedPoints.map((point) => point.y));
  const scale = Math.min((width - 80) / Math.max(maxX - minX, 0.01), (height - 110) / Math.max(maxY - minY, 0.01));
  const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale + 20;

  context.strokeStyle = "rgba(148, 163, 184, 0.16)";
  context.lineWidth = 1;
  for (let grid = -4; grid <= 4; grid += 1) {
    context.beginPath();
    context.moveTo(width * 0.16, height * 0.72 + grid * 14);
    context.lineTo(width * 0.84, height * 0.72 + grid * 14);
    context.stroke();
  }

  const bounds = summary.bounds;
  const corners: [number, number, number][] = [
    [bounds.min[0], bounds.min[1], bounds.min[2]],
    [bounds.max[0], bounds.min[1], bounds.min[2]],
    [bounds.max[0], bounds.max[1], bounds.min[2]],
    [bounds.min[0], bounds.max[1], bounds.min[2]],
    [bounds.min[0], bounds.min[1], bounds.max[2]],
    [bounds.max[0], bounds.min[1], bounds.max[2]],
    [bounds.max[0], bounds.max[1], bounds.max[2]],
    [bounds.min[0], bounds.max[1], bounds.max[2]],
  ].map((point) => [
    (point[0] - center[0]) / maxSize,
    (point[1] - center[1]) / maxSize,
    (point[2] - center[2]) / maxSize,
  ] as [number, number, number]);
  const projectedCorners = corners.map((point) => {
    const projected = projectIso(point);
    return { x: projected.x * scale + offsetX, y: projected.y * scale + offsetY };
  });
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  context.strokeStyle = "rgba(56, 189, 248, 0.34)";
  context.lineWidth = 1.2;
  for (const [a, b] of edges) {
    context.beginPath();
    context.moveTo(projectedCorners[a].x, projectedCorners[a].y);
    context.lineTo(projectedCorners[b].x, projectedCorners[b].y);
    context.stroke();
  }

  context.fillStyle = "rgba(249, 115, 22, 0.58)";
  for (const point of normalizedPoints) {
    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;
    context.fillRect(x, y, 1.45, 1.45);
  }

  context.fillStyle = "rgba(226, 232, 240, 0.96)";
  context.font = "700 12px system-ui, sans-serif";
  context.fillText(text(language, "STEP-CAD Punktvorschau", "STEP CAD point preview"), 18, 26);
  context.fillStyle = "rgba(148, 163, 184, 0.95)";
  context.font = "12px system-ui, sans-serif";
  context.fillText(
    text(
      language,
      `${summary.previewPoints.length.toLocaleString("de-DE")} Punkte visualisiert`,
      `${summary.previewPoints.length.toLocaleString("en-US")} points visualized`,
    ),
    18,
    46,
  );
  context.fillText(
    text(
      language,
      `Bauraum ca. ${summary.bounds.size.map((value) => value.toFixed(1)).join(" x ")}`,
      `Bounds approx. ${summary.bounds.size.map((value) => value.toFixed(1)).join(" x ")}`,
    ),
    18,
    height - 20,
  );
}

function renderStlCanvasFallback(host: HTMLDivElement, buffer: ArrayBuffer, language: Language) {
  const triangles = parseStlTriangles(buffer);
  if (!triangles.length) {
    throw new Error("STL konnte nicht als 2D-Fallback gelesen werden.");
  }

  host.innerHTML = "";
  const width = host.clientWidth || 640;
  const height = host.clientHeight || 360;
  const pixelRatio = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(height * pixelRatio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  host.appendChild(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas-2D ist in diesem Browser nicht verfügbar.");
  }

  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "#121720";
  context.fillRect(0, 0, width, height);

  const projectedTriangles = triangles.map((triangle) => triangle.map(projectIso));
  const points = projectedTriangles.flat();
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const modelWidth = Math.max(maxX - minX, 1);
  const modelHeight = Math.max(maxY - minY, 1);
  const scale = Math.min((width - 48) / modelWidth, (height - 72) / modelHeight);
  const offsetX = (width - modelWidth * scale) / 2 - minX * scale;
  const offsetY = (height - modelHeight * scale) / 2 - minY * scale + 14;

  context.lineWidth = 0.65;
  context.strokeStyle = "rgba(251, 146, 60, 0.55)";
  context.fillStyle = "rgba(249, 115, 22, 0.08)";

  for (const triangle of projectedTriangles) {
    context.beginPath();
    context.moveTo(triangle[0].x * scale + offsetX, triangle[0].y * scale + offsetY);
    context.lineTo(triangle[1].x * scale + offsetX, triangle[1].y * scale + offsetY);
    context.lineTo(triangle[2].x * scale + offsetX, triangle[2].y * scale + offsetY);
    context.closePath();
    context.fill();
    context.stroke();
  }

  context.fillStyle = "rgba(226, 232, 240, 0.92)";
  context.font = "600 12px system-ui, sans-serif";
  context.fillText(
    text(language, "2D-Fallback ohne WebGL", "2D fallback without WebGL"),
    16,
    24,
  );
  context.fillStyle = "rgba(148, 163, 184, 0.95)";
  context.font = "12px system-ui, sans-serif";
  context.fillText(
    text(
      language,
      `${triangles.length.toLocaleString("de-DE")} Dreiecke dargestellt`,
      `${triangles.length.toLocaleString("en-US")} triangles shown`,
    ),
    16,
    44,
  );
}

export function ThreeDViewer({ file, language = "de", getFileObjectUrlOverride, previewLimitMb }: ThreeDViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [viewerStatus, setViewerStatus] = useState("");
  const [viewerError, setViewerError] = useState<ViewerError | null>(null);
  const [stepSummary, setStepSummary] = useState<StepSummary | null>(null);
  const { getFileObjectUrl, settings } = useMakershelf();
  const previewLimitBytes = (previewLimitMb ?? settings.maxPreviewFileSizeMb) * 1024 * 1024;
  const exceedsPreviewLimit = Boolean(file && file.sizeBytes > previewLimitBytes);

  useEffect(() => {
    if (!file || file.type !== "STEP" || exceedsPreviewLimit || !mountRef.current) {
      setStepSummary(null);
      return;
    }

    let disposed = false;
    let objectUrl = "";
    const activeFile = file;
    const host = mountRef.current;

    async function loadStepSummary() {
      setViewerStatus(text(language, "Lade STEP-Analyse...", "Loading STEP analysis..."));
      setViewerError(null);
      setStepSummary(null);
      if (host) {
        host.innerHTML = "";
      }

      try {
        objectUrl = getFileObjectUrlOverride
          ? (await getFileObjectUrlOverride(activeFile)) || ""
          : (await getFileObjectUrl(activeFile.id)) || "";
        if (!objectUrl) {
          setViewerStatus(
            text(language, "Für diese Datei sind lokal keine Daten mehr vorhanden.", "No local data is available for this file anymore."),
          );
          return;
        }

        const content = await fetchObjectText(objectUrl);
        if (!disposed) {
          const summary = parseStepSummary(content);
          setStepSummary(summary);
          if (host) {
            renderStepCanvasPreview(host, summary, language);
          }
          setViewerStatus(text(language, "STEP-Vorschau bereit", "STEP preview ready"));
        }
      } catch (error) {
        if (!disposed) {
          const nextError = getViewerError(error, language);
          setViewerError({
            title: text(language, "STEP-Datei konnte nicht analysiert werden.", "STEP file could not be analyzed."),
            detail: nextError.detail,
          });
          setViewerStatus(text(language, "STEP-Datei konnte nicht analysiert werden.", "STEP file could not be analyzed."));
        }
      }
    }

    loadStepSummary();

    return () => {
      disposed = true;
      if (host) {
        host.innerHTML = "";
      }
      if (objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [exceedsPreviewLimit, file, getFileObjectUrl, getFileObjectUrlOverride, language]);

  useEffect(() => {
    if (file?.type === "STEP") {
      return;
    }

    if (!file || !renderableTypes.has(file.type) || exceedsPreviewLimit || !mountRef.current) {
      setViewerStatus("");
      setViewerError(null);
      return;
    }

    let disposed = false;
    let cleanup = () => undefined;
    const activeFile = file;
    async function loadScene() {
      const host = mountRef.current;

      if (!host) {
        return;
      }

      setViewerStatus(text(language, "Lade 3D-Vorschau...", "Loading 3D preview..."));
      setViewerError(null);
      host.innerHTML = "";

      let objectUrl = "";

      try {
        objectUrl = getFileObjectUrlOverride
          ? await getFileObjectUrlOverride(activeFile)
          : await getFileObjectUrl(activeFile.id);
        if (!objectUrl) {
          setViewerStatus(
            text(language, "Für diese Datei sind lokal keine Daten mehr vorhanden.", "No local data is available for this file anymore."),
          );
          return;
        }

        try {
          assertWebGlAvailable();
        } catch (error) {
          if (activeFile.type === "STL") {
            renderStlCanvasFallback(
              host,
              await fetchObjectArrayBuffer(objectUrl),
              language,
            );
            setViewerStatus(
              text(
                language,
                "2D-Vorschau aktiv (WebGL nicht verfügbar)",
                "2D preview active (WebGL unavailable)",
              ),
            );
            cleanup = () => {
              host.innerHTML = "";
              if (objectUrl.startsWith("blob:")) {
                URL.revokeObjectURL(objectUrl);
              }
            };
            return;
          }

          throw error;
        }

        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
        const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
        const { GCodeLoader } = await import("three/examples/jsm/loaders/GCodeLoader.js");

        if (disposed || !mountRef.current) {
          return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#121720");

        const width = host.clientWidth || 640;
        const height = host.clientHeight || 360;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
        camera.position.set(120, 110, 140);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.target.set(0, 0, 0);

        const ambient = new THREE.AmbientLight("#ffffff", 1.5);
        const keyLight = new THREE.DirectionalLight("#ffffff", 2.2);
        keyLight.position.set(120, 160, 90);
        const fillLight = new THREE.DirectionalLight("#7dd3fc", 1.2);
        fillLight.position.set(-100, 80, -80);
        scene.add(ambient, keyLight, fillLight);

        const grid = new THREE.GridHelper(220, 20, "#475569", "#1f2937");
        scene.add(grid);

        const axes = new THREE.AxesHelper(40);
        axes.position.set(-70, 0, -70);
        scene.add(axes);

        const material = new THREE.MeshStandardMaterial({
          color: "#f97316",
          metalness: 0.18,
          roughness: 0.58,
        });

        let object: InstanceType<typeof THREE.Object3D>;

        if (activeFile.type === "STL") {
          const geometry = new STLLoader().parse(await fetchObjectArrayBuffer(objectUrl));
          geometry.computeVertexNormals();
          object = new THREE.Mesh(geometry, material);
        } else if (activeFile.type === "OBJ") {
          object = await new OBJLoader().loadAsync(objectUrl);
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = material;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        } else if (activeFile.type === "3MF") {
          object = new ThreeMFLoader().parse(await fetchObjectArrayBuffer(objectUrl));
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (!child.material) {
                child.material = material;
              }
            }
          });
        } else {
          object = new GCodeLoader().parse(await fetchObjectText(objectUrl));
        }

        if (disposed) {
          renderer.dispose();
          return;
        }

        const initialBox = new THREE.Box3().setFromObject(object);
        const initialSize = initialBox.getSize(new THREE.Vector3());
        const initialCenter = initialBox.getCenter(new THREE.Vector3());
        const maxSize = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
        const scale = 70 / maxSize;

        if (!Number.isFinite(maxSize) || maxSize <= 0 || initialBox.isEmpty()) {
          throw new Error("Die Datei enthaelt keine zentrierbare Geometrie.");
        }

        object.position.sub(initialCenter);
        const modelRoot = new THREE.Group();
        modelRoot.name = "centered-model-root";
        modelRoot.add(object);
        modelRoot.scale.setScalar(scale);
        scene.add(modelRoot);

        const fittedBox = new THREE.Box3().setFromObject(modelRoot);
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
        modelRoot.position.sub(fittedCenter);
        fittedBox.setFromObject(modelRoot);
        const centeredSize = fittedBox.getSize(new THREE.Vector3());
        const centeredCenter = fittedBox.getCenter(new THREE.Vector3());
        const maxDimension = Math.max(centeredSize.x, centeredSize.y, centeredSize.z) || 1;
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const cameraDistance = Math.max(
          (maxDimension * 0.9) / Math.tan(verticalFov / 2),
          90,
        );
        const offsetDirection = new THREE.Vector3(1, 0.78, 1.15).normalize();
        const cameraPosition = centeredCenter
          .clone()
          .add(offsetDirection.multiplyScalar(cameraDistance));

        const gridSize = Math.max(Math.ceil(maxDimension * 2.6), 120);
        scene.remove(grid);
        const fittedGrid = new THREE.GridHelper(
          gridSize,
          Math.max(Math.round(gridSize / 12), 10),
          "#475569",
          "#1f2937",
        );
        scene.add(fittedGrid);

        axes.position.set(-gridSize * 0.32, 0, -gridSize * 0.32);
        camera.near = Math.max(0.1, cameraDistance / 100);
        camera.far = cameraDistance * 10;
        camera.position.copy(cameraPosition);
        controls.target.copy(centeredCenter);
        camera.lookAt(centeredCenter);
        controls.update();

        const onResize = () => {
          const nextWidth = host.clientWidth || 640;
          const nextHeight = host.clientHeight || 360;
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight);
        };

        window.addEventListener("resize", onResize);

        let frameId = 0;
        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          frameId = window.requestAnimationFrame(animate);
        };

        animate();
        setViewerStatus(text(language, "3D-Vorschau aktiv", "3D preview active"));

        cleanup = () => {
          window.cancelAnimationFrame(frameId);
          window.removeEventListener("resize", onResize);
          controls.dispose();
          renderer.dispose();
          scene.traverse((child) => {
            const renderChild = child as typeof child & {
              geometry?: { dispose?: () => void };
              material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
            };

            renderChild.geometry?.dispose?.();
            const childMaterial = renderChild.material;
            if (childMaterial) {
              if (Array.isArray(childMaterial)) {
                childMaterial.forEach((entry) => entry.dispose?.());
              } else {
                childMaterial?.dispose?.();
              }
            }
          });
          host.innerHTML = "";
          if (objectUrl.startsWith("blob:")) {
            URL.revokeObjectURL(objectUrl);
          }
        };
      } catch (error) {
        console.error("[Makershelf] 3D viewer failed", {
          file: activeFile,
          error,
        });
        host.innerHTML = "";
        if (activeFile.type === "STL" && objectUrl) {
          try {
            renderStlCanvasFallback(
              host,
              await fetchObjectArrayBuffer(objectUrl),
              language,
            );
            setViewerError(null);
            setViewerStatus(
              text(
                language,
                "2D-Vorschau aktiv (3D-Render nicht verfügbar)",
                "2D preview active (3D render unavailable)",
              ),
            );
            cleanup = () => {
              host.innerHTML = "";
              if (objectUrl.startsWith("blob:")) {
                URL.revokeObjectURL(objectUrl);
              }
            };
            return;
          } catch (fallbackError) {
            console.error("[Makershelf] STL fallback failed", {
              file: activeFile,
              error: fallbackError,
            });
          }
        }

        const nextError = getViewerError(error, language);
        setViewerError(nextError);
        setViewerStatus(nextError.title);
      }
    }

    loadScene();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [exceedsPreviewLimit, file, getFileObjectUrl, getFileObjectUrlOverride, language]);

  if (!file) {
    return (
      <section className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] accent-text">
          Model Viewer
        </p>
        <p className="mt-3 text-muted">
          {text(
            language,
            "Wähle eine Datei aus der Liste aus, um hier die Vorschau und Metadaten zu sehen.",
            "Choose a file from the list to see its preview and metadata here.",
          )}
        </p>
      </section>
    );
  }

  const canRender = renderableTypes.has(file.type) && !exceedsPreviewLimit;
  const canAnalyzeStep = file.type === "STEP" && !exceedsPreviewLimit;

  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,#1e2430_0%,#121720_100%)] p-6 text-white shadow-[0_24px_90px_rgba(15,23,42,0.35)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(180deg,white,transparent)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Model Viewer</p>
          <h3 className="mt-2 text-2xl font-semibold">{file.name}</h3>
          <p className="mt-2 text-sm text-slate-300">
            {file.type} · {file.sizeLabel}
          </p>
        </div>
        <div className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200">
          {file.folderPath || "Root"}
        </div>
      </div>

      <div className="relative mt-10 min-h-[320px] overflow-hidden rounded-xl border border-white/10 bg-[#121720]">
        {canRender ? (
          <div className="relative h-[360px] w-full">
            <div ref={mountRef} className="h-full w-full" />
            {viewerError ? (
              <div className="absolute inset-0 grid content-center gap-3 bg-[#121720]/95 px-6 text-center">
                <p className="text-sm font-semibold uppercase text-slate-400">
                  {text(language, "Viewer-Fehler", "Viewer error")}
                </p>
                <p className="text-base font-semibold text-white">{viewerError.title}</p>
                <p className="mx-auto max-w-2xl break-words text-sm text-slate-300">
                  {viewerError.detail}
                </p>
              </div>
            ) : null}
          </div>
        ) : canAnalyzeStep ? (
          <div className="grid min-h-[360px] gap-5 px-6 py-8 text-slate-300">
            {viewerError ? (
              <div className="rounded-xl border border-red-400/30 bg-red-950/30 p-4">
                <p className="text-sm font-semibold text-white">{viewerError.title}</p>
                <p className="mt-2 break-words text-sm text-slate-300">{viewerError.detail}</p>
              </div>
            ) : null}
            <div className="relative h-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#121720]">
              <div ref={mountRef} className="h-full w-full" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                {text(language, "STEP Vorschau", "STEP preview")}
              </p>
              <p className="mt-3 max-w-2xl text-base text-slate-300">
                {text(
                  language,
                  "makershelf liest die CAD-Punkte aus der STEP-Datei und zeichnet daraus eine zentrierte Vorschau mit Bauraum. Für eine exakte BREP-Tessellierung wäre weiterhin ein CAD-Konverter nötig.",
                  "makershelf reads CAD points from the STEP file and draws a centered preview with bounds. Exact BREP tessellation still requires a CAD converter.",
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [text(language, "Produkt", "Product"), stepSummary?.product || file.name],
                [text(language, "Schema", "Schema"), stepSummary?.schema || "STEP"],
                [text(language, "Elemente", "Entities"), stepSummary?.entityCount?.toLocaleString("de-DE") || "-"],
                [text(language, "Vorschaupunkte", "Preview points"), stepSummary?.previewPoints.length.toLocaleString("de-DE") || "-"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 break-words text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Points
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stepSummary?.points?.toLocaleString("de-DE") || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {text(language, "Flaechen", "Faces")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stepSummary?.faces?.toLocaleString("de-DE") || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Solids / Shells
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stepSummary?.solids?.toLocaleString("de-DE") || "-"}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Datei
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-white">
                {stepSummary?.fileName || file.originalName}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-[360px] items-center justify-center px-6 text-center text-slate-300">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                {text(language, "Technische Vorschau", "Technical preview")}
              </p>
              <p className="text-base font-semibold">
                {text(
                  language,
                  exceedsPreviewLimit
                    ? `${file.type} ist für die Live-Vorschau zu gross.`
                    : `${file.type} wird aktuell noch nicht als 3D-Ansicht gerendert.`,
                  exceedsPreviewLimit
                    ? `${file.type} is too large for live preview.`
                    : `${file.type} is not rendered as a 3D view yet.`,
                )}
              </p>
              <p className="text-sm text-slate-400">
                {text(
                  language,
                  exceedsPreviewLimit
                    ? `Aktuelles Vorschau-Limit: ${previewLimitMb ?? settings.maxPreviewFileSizeMb} MB. Du kannst den Wert in den Advanced Settings anheben.`
                    : "STL-, OBJ-, 3MF- und GCODE-Dateien werden direkt im Viewer dargestellt.",
                  exceedsPreviewLimit
                    ? `Current preview limit: ${previewLimitMb ?? settings.maxPreviewFileSizeMb} MB. You can raise it in advanced settings.`
                    : "STL, OBJ, 3MF and GCODE files are rendered directly in the viewer.",
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>{viewerStatus}</span>
        <span>
          {canRender
            ? text(language, "Maus: drehen / scrollen: zoomen", "Mouse: rotate / scroll: zoom")
            : exceedsPreviewLimit
              ? text(language, "Preview-Limit aktiv", "Preview limit active")
              : canAnalyzeStep
                ? text(language, "CAD-Analyse ohne Tessellierung", "CAD analysis without tessellation")
                : text(language, "Direkter 3D-Render für STL, OBJ, 3MF und GCODE", "Direct 3D render for STL, OBJ, 3MF and GCODE")}
        </span>
      </div>

      <div className="relative mt-6 grid gap-2 text-sm text-slate-300">
        <p>Original: {file.originalPath || file.originalName}</p>
        <p>Projektpfad: {file.storedPath}</p>
        <p>Quelle: {file.extractedFromZip ? `ZIP ${file.extractedFromZip}` : file.source}</p>
      </div>
    </section>
  );
}
