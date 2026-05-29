"use client";

import { useRef, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import type { Language } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "stl-to-step";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconImage() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function IconCube() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4.5v9L12 20 4 15.5v-9L12 2z" />
      <path d="M12 2v18M4 6.5l8 4.5 8-4.5" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29" />
    </svg>
  );
}

// ─── STL Generation Helpers ───────────────────────────────────────────────────

function floatLE(val: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, true);
  return new Uint8Array(buf);
}

function uint32LE(val: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, val, true);
  return new Uint8Array(buf);
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

/** Write a single triangle into a pre-allocated triangle buffer at byte offset */
function writeTri(
  buf: DataView,
  offset: number,
  nx: number, ny: number, nz: number,
  v1: [number, number, number],
  v2: [number, number, number],
  v3: [number, number, number],
) {
  buf.setFloat32(offset, nx, true); buf.setFloat32(offset + 4, ny, true); buf.setFloat32(offset + 8, nz, true);
  buf.setFloat32(offset + 12, v1[0], true); buf.setFloat32(offset + 16, v1[1], true); buf.setFloat32(offset + 20, v1[2], true);
  buf.setFloat32(offset + 24, v2[0], true); buf.setFloat32(offset + 28, v2[1], true); buf.setFloat32(offset + 32, v2[2], true);
  buf.setFloat32(offset + 36, v3[0], true); buf.setFloat32(offset + 40, v3[1], true); buf.setFloat32(offset + 44, v3[2], true);
  buf.setUint16(offset + 48, 0, true); // attribute byte count
}

/**
 * Generate a lithophane binary STL from an ImageData.
 * Light areas → thin (near 0), dark areas → thick (near maxDepthMm).
 * Returns a Uint8Array containing the binary STL.
 */
function generateLithophaneStl(
  imageData: ImageData,
  widthMm: number,
  maxDepthMm: number,
  baseThicknessMm: number,
): Uint8Array {
  const { width: px, height: py, data } = imageData;

  // Sample at 2×2 super-pixel resolution if image is very large
  const sampleStep = Math.max(1, Math.ceil(Math.max(px, py) / 300));
  const cols = Math.ceil(px / sampleStep);
  const rows = Math.ceil(py / sampleStep);
  const cellW = widthMm / cols;
  const cellH = (widthMm * (py / px)) / rows;
  const totalHeightMm = widthMm * (py / px);

  // Build height map (normalised luminance → Z height)
  const heights = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const srcX = Math.min(col * sampleStep, px - 1);
      const srcY = Math.min(row * sampleStep, py - 1);
      const idx = (srcY * px + srcX) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      // sRGB luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // White = thin, black = thick
      heights[row * cols + col] = baseThicknessMm + (1 - lum) * maxDepthMm;
    }
  }

  // Triangles: top surface (2 per quad) + bottom plate (2 per quad) + 4 side walls (2 per edge)
  const topTris = (rows - 1) * (cols - 1) * 2;
  const bottomTris = (rows - 1) * (cols - 1) * 2;
  const sideTrisX = (cols - 1) * 2 * 2; // front + back
  const sideTrisY = (rows - 1) * 2 * 2; // left + right
  const totalTris = topTris + bottomTris + sideTrisX + sideTrisY;

  const header = new Uint8Array(80); // blank header
  const triCount = uint32LE(totalTris);
  const triBytes = totalTris * 50;
  const triBuffer = new ArrayBuffer(triBytes);
  const triView = new DataView(triBuffer);
  let offset = 0;

  function addTri(
    nx: number, ny: number, nz: number,
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
  ) {
    writeTri(triView, offset, nx, ny, nz, v1, v2, v3);
    offset += 50;
  }

  // Top surface
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const x0 = col * cellW, x1 = (col + 1) * cellW;
      const y0 = row * cellH, y1 = (row + 1) * cellH;
      const h00 = heights[row * cols + col];
      const h10 = heights[row * cols + (col + 1)];
      const h01 = heights[(row + 1) * cols + col];
      const h11 = heights[(row + 1) * cols + (col + 1)];
      addTri(0, 0, 1, [x0, y0, h00], [x1, y0, h10], [x1, y1, h11]);
      addTri(0, 0, 1, [x0, y0, h00], [x1, y1, h11], [x0, y1, h01]);
    }
  }

  // Bottom flat plate (z=0, normal pointing down)
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const x0 = col * cellW, x1 = (col + 1) * cellW;
      const y0 = row * cellH, y1 = (row + 1) * cellH;
      addTri(0, 0, -1, [x0, y0, 0], [x1, y1, 0], [x1, y0, 0]);
      addTri(0, 0, -1, [x0, y0, 0], [x0, y1, 0], [x1, y1, 0]);
    }
  }

  // Side walls — front (row=0, normal y=-1)
  for (let col = 0; col < cols - 1; col++) {
    const x0 = col * cellW, x1 = (col + 1) * cellW;
    const z0 = heights[col], z1 = heights[col + 1];
    addTri(0, -1, 0, [x0, 0, 0], [x1, 0, 0], [x1, 0, z1]);
    addTri(0, -1, 0, [x0, 0, 0], [x1, 0, z1], [x0, 0, z0]);
  }
  // Back (row=rows-1, normal y=+1)
  for (let col = 0; col < cols - 1; col++) {
    const x0 = col * cellW, x1 = (col + 1) * cellW;
    const base = (rows - 1) * cols;
    const z0 = heights[base + col], z1 = heights[base + col + 1];
    addTri(0, 1, 0, [x1, totalHeightMm, 0], [x0, totalHeightMm, 0], [x0, totalHeightMm, z0]);
    addTri(0, 1, 0, [x1, totalHeightMm, 0], [x0, totalHeightMm, z0], [x1, totalHeightMm, z1]);
  }
  // Left (col=0, normal x=-1)
  for (let row = 0; row < rows - 1; row++) {
    const y0 = row * cellH, y1 = (row + 1) * cellH;
    const z0 = heights[row * cols], z1 = heights[(row + 1) * cols];
    addTri(-1, 0, 0, [0, y1, 0], [0, y0, 0], [0, y0, z0]);
    addTri(-1, 0, 0, [0, y1, 0], [0, y0, z0], [0, y1, z1]);
  }
  // Right (col=cols-1, normal x=+1)
  for (let row = 0; row < rows - 1; row++) {
    const y0 = row * cellH, y1 = (row + 1) * cellH;
    const z0 = heights[row * cols + (cols - 1)], z1 = heights[(row + 1) * cols + (cols - 1)];
    addTri(1, 0, 0, [widthMm, y0, 0], [widthMm, y1, 0], [widthMm, y1, z1]);
    addTri(1, 0, 0, [widthMm, y0, 0], [widthMm, y1, z1], [widthMm, y0, z0]);
  }

  return concatBytes([header, triCount, new Uint8Array(triBuffer)]);
}

function downloadBlob(data: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Lithophane Tool ──────────────────────────────────────────────────────────

function LithophaneTool({ lang }: { lang: Language }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [widthMm, setWidthMm] = useState(100);
  const [maxDepthMm, setMaxDepthMm] = useState(3);
  const [baseThicknessMm, setBaseThicknessMm] = useState(0.6);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string>("");

  function handleImageFile(file: File) {
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        // Generate grayscale preview
        const previewCanvas = document.createElement("canvas");
        const scale = Math.min(1, 300 / Math.max(img.width, img.height));
        previewCanvas.width = img.width * scale;
        previewCanvas.height = img.height * scale;
        const pCtx = previewCanvas.getContext("2d");
        if (pCtx) {
          pCtx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
          const d = pCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
          // Invert to show how the lithophane will look (light = raised)
          for (let i = 0; i < d.data.length; i += 4) {
            const lum = 0.2126 * d.data[i] / 255 + 0.7152 * d.data[i + 1] / 255 + 0.0722 * d.data[i + 2] / 255;
            const v = Math.round((1 - lum) * 255);
            d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
          }
          pCtx.putImageData(d, 0, 0);
          setPreview(previewCanvas.toDataURL());
        }
        setImageLoaded(true);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleGenerate() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setGenerating(true);
    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const stl = generateLithophaneStl(imageData, widthMm, maxDepthMm, baseThicknessMm);
        const baseName = imageName.replace(/\.[^.]+$/, "") || "lithophane";
        downloadBlob(stl, `${baseName}-lithophane.stl`, "model/stl");
      } finally {
        setGenerating(false);
      }
    }, 50);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
      {/* Left: Upload + Preview */}
      <div>
        <div
          style={{ border: "2px dashed var(--border)", borderRadius: "10px", padding: "32px", textAlign: "center", cursor: "pointer", marginBottom: "16px" }}
          onClick={() => document.getElementById("litho-input")?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
        >
          <input
            id="litho-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
          />
          {preview ? (
            <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain", borderRadius: "6px" }} />
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px", color: "var(--text-muted)" }}><IconImage /></div>
              <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{text(lang, "Bild ablegen oder klicken", "Drop image or click")}</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>JPG, PNG, WebP, BMP</p>
            </>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {imageLoaded && (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
            {text(lang, "Vorschau zeigt Lithophane-Effekt (invertiert)", "Preview shows lithophane effect (inverted)")}
          </p>
        )}
      </div>

      {/* Right: Settings + Generate */}
      <div>
        <div className="panel panel-padded" style={{ marginBottom: "16px" }}>
          <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "16px" }}>{text(lang, "Parameter", "Parameters")}</p>

          {[
            { label: text(lang, "Breite (mm)", "Width (mm)"), value: widthMm, set: setWidthMm, min: 20, max: 500 },
            { label: text(lang, "Max. Tiefe (mm)", "Max depth (mm)"), value: maxDepthMm, set: setMaxDepthMm, min: 0.5, max: 10, step: 0.1 },
            { label: text(lang, "Boden-Stärke (mm)", "Base thickness (mm)"), value: baseThicknessMm, set: setBaseThicknessMm, min: 0.2, max: 5, step: 0.1 },
          ].map(({ label, value, set, min, max, step }) => (
            <div key={label} style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>{label}</label>
                <span style={{ fontSize: "12px", fontWeight: 700 }}>{value}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step ?? 1}
                value={value}
                onChange={(e) => set(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          ))}

          <div style={{ marginTop: "6px", padding: "10px 12px", background: "var(--panel-muted, #18181f)", borderRadius: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
            <p style={{ marginBottom: "2px" }}>📐 {text(lang, "Ausgabe", "Output")}:</p>
            <p style={{ fontWeight: 600, color: "var(--text-main)" }}>
              {widthMm} × {text(lang, "proportional", "proportional")} mm, {(baseThicknessMm + maxDepthMm).toFixed(1)} mm {text(lang, "max. Höhe", "max height")}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          disabled={!imageLoaded || generating}
          onClick={handleGenerate}
        >
          <IconDownload />
          {generating
            ? text(lang, "Generiert…", "Generating…")
            : text(lang, "STL generieren & herunterladen", "Generate & download STL")}
        </button>

        <div className="panel" style={{ marginTop: "16px", padding: "14px 16px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>💡 {text(lang, "Hinweise", "Tips")}</p>
          <ul style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "16px", lineHeight: 1.6 }}>
            <li>{text(lang, "Hoher Kontrast → besseres Ergebnis", "High contrast → better result")}</li>
            <li>{text(lang, "Drucke mit 0.1–0.15mm Schichthöhe", "Print with 0.1–0.15mm layer height")}</li>
            <li>{text(lang, "Weißes/helles Filament empfohlen", "White/light filament recommended")}</li>
            <li>{text(lang, "3–5mm Gesamtstärke typisch", "3–5mm total thickness typical")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── File Splitter Tool ───────────────────────────────────────────────────────

function FileSplitterTool({ lang }: { lang: Language }) {
  const [mode, setMode] = useState<"simple" | "auto">("simple");
  const [axis, setAxis] = useState<"X" | "Y" | "Z">("X");
  const [offset, setOffset] = useState(50);
  const [pinDiameter, setPinDiameter] = useState(3);
  const [pinCount, setPinCount] = useState(4);
  const [fileName, setFileName] = useState("");

  function handleFileDrop(file: File) {
    setFileName(file.name);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
      {/* Left: Upload + options */}
      <div>
        <div
          style={{ border: "2px dashed var(--border)", borderRadius: "10px", padding: "32px", textAlign: "center", cursor: "pointer", marginBottom: "16px" }}
          onClick={() => document.getElementById("splitter-input")?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}
        >
          <input
            id="splitter-input"
            type="file"
            accept=".stl,.3mf,.obj"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); e.target.value = ""; }}
          />
          {fileName ? (
            <div>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📦</div>
              <p style={{ fontWeight: 600, fontSize: "13px" }}>{fileName}</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{text(lang, "Andere Datei wählen", "Choose different file")}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px", color: "var(--text-muted)" }}><IconCube /></div>
              <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{text(lang, "3D-Datei ablegen oder klicken", "Drop 3D file or click")}</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>STL, 3MF, OBJ</p>
            </>
          )}
        </div>

        {/* Mode */}
        <div className="panel panel-padded">
          <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "12px" }}>{text(lang, "Modus", "Mode")}</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {([
              { id: "simple" as const, label: text(lang, "Manuell", "Manual") },
              { id: "auto" as const, label: text(lang, "Automatisch", "Automatic") },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`btn btn-sm${mode === m.id ? " btn-primary" : " btn-ghost"}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "simple" && (
            <>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
                  {text(lang, "Schnittachse", "Cut Axis")}
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["X", "Y", "Z"] as const).map((a) => (
                    <button key={a} type="button" className={`btn btn-sm${axis === a ? " btn-primary" : " btn-ghost"}`} onClick={() => setAxis(a)}>{a}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>{text(lang, "Position (%)", "Position (%)")}</label>
                  <span style={{ fontSize: "12px", fontWeight: 700 }}>{offset}%</span>
                </div>
                <input type="range" min={5} max={95} value={offset} onChange={(e) => setOffset(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
            </>
          )}

          {mode === "auto" && (
            <div style={{ padding: "12px", background: "var(--panel-muted, #18181f)", borderRadius: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              {text(
                lang,
                "Der automatische Modus analysiert das Modell und wählt optimale Schnittebenen, um alle Teile auf dein Druckbett zu passen.",
                "Automatic mode analyzes the model and selects optimal cut planes so all parts fit on your print bed.",
              )}
              <div style={{ marginTop: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                  {text(lang, "Bettgröße X×Y (mm)", "Bed size X×Y (mm)")}
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input className="input" type="number" defaultValue={220} min={50} max={1000} style={{ width: "80px" }} />
                  <span style={{ alignSelf: "center", color: "var(--text-muted)" }}>×</span>
                  <input className="input" type="number" defaultValue={220} min={50} max={1000} style={{ width: "80px" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Pin settings + preview diagram + generate */}
      <div>
        <div className="panel panel-padded" style={{ marginBottom: "16px" }}>
          <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "16px" }}>
            {text(lang, "Verbindungspins", "Connecting Pins")}
          </p>
          {[
            { label: text(lang, "Pin-Durchmesser (mm)", "Pin diameter (mm)"), value: pinDiameter, set: setPinDiameter, min: 1, max: 12, step: 0.5 },
            { label: text(lang, "Anzahl Pins", "Number of pins"), value: pinCount, set: setPinCount, min: 2, max: 16, step: 1 },
          ].map(({ label, value, set, min, max, step }) => (
            <div key={label} style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>{label}</label>
                <span style={{ fontSize: "12px", fontWeight: 700 }}>{value}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
          ))}

          {/* Diagram */}
          <svg viewBox="0 0 200 100" style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "6px", marginTop: "8px" }}>
            <rect x="10" y="20" width="80" height="60" rx="4" fill="var(--panel-muted, #18181f)" stroke="var(--primary)" strokeWidth="1.5" />
            <rect x="110" y="20" width="80" height="60" rx="4" fill="var(--panel-muted, #18181f)" stroke="var(--primary)" strokeWidth="1.5" />
            {/* Cut line */}
            <line x1="100" y1="10" x2="100" y2="90" stroke="var(--danger)" strokeWidth="1" strokeDasharray="4 2" />
            {/* Pins */}
            {Array.from({ length: Math.min(pinCount, 4) }, (_, i) => {
              const y = 30 + i * (50 / Math.max(Math.min(pinCount, 4) - 1, 1));
              return (
                <g key={i}>
                  <rect x="90" y={y - 3} width="20" height="6" rx="3" fill="var(--primary)" opacity="0.8" />
                </g>
              );
            })}
            <text x="50" y="95" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{text(lang, "Teil A", "Part A")}</text>
            <text x="150" y="95" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{text(lang, "Teil B", "Part B")}</text>
          </svg>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          disabled={!fileName}
          onClick={() => {
            // Server-side processing needed for actual geometry splitting
            // For now show a clear message
            alert(text(
              lang,
              "Das Teilen von 3D-Dateien erfordert serverseitige Geometrie-Verarbeitung. Diese Funktion wird in einem kommenden Update als Server-Komponente verfügbar.",
              "Splitting 3D files requires server-side geometry processing. This feature will be available in an upcoming update as a server component.",
            ));
          }}
        >
          <IconDownload />
          {text(lang, "Teilen & herunterladen (ZIP)", "Split & download (ZIP)")}
        </button>

        <div className="panel" style={{ marginTop: "16px", padding: "14px 16px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>💡 {text(lang, "Hinweise", "Tips")}</p>
          <ul style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "16px", lineHeight: 1.6 }}>
            <li>{text(lang, "3–4mm Pin-Durchmesser für feste Verbindung", "3–4mm pin diameter for solid connection")}</li>
            <li>{text(lang, "0.2mm Spiel zwischen Pin und Loch einplanen", "Plan 0.2mm clearance between pin and hole")}</li>
            <li>{text(lang, "Pins senkrecht zur Trennfläche orientieren", "Orient pins perpendicular to split plane")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── STL → STEP Tool ─────────────────────────────────────────────────────────

function StlToStepTool({ lang }: { lang: Language }) {
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<{ triangles: number } | null>(null);
  const [error, setError] = useState<string>("");

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError("");
  }

  async function handleConvert() {
    if (!file) return;
    setConverting(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tools/stl-to-step", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Unbekannter Fehler" })) as { error?: string };
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const triangles = Number(res.headers.get("X-Triangle-Count") ?? 0);
      const blob = await res.blob();
      const baseName = file.name.replace(/\.stl$/i, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.step`;
      a.click();
      URL.revokeObjectURL(url);
      setResult({ triangles });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConverting(false);
    }
  }

  const fileSizeMb = file ? (file.size / 1024 / 1024).toFixed(2) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
      {/* Left: Drop zone */}
      <div>
        <div
          style={{
            border: `2px dashed ${file ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "10px",
            padding: "36px 24px",
            textAlign: "center",
            cursor: "pointer",
            marginBottom: "16px",
            background: file ? "color-mix(in srgb, var(--primary) 6%, var(--panel))" : undefined,
            transition: "border-color 0.15s, background 0.15s",
          }}
          onClick={() => document.getElementById("step-input")?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.name.toLowerCase().endsWith(".stl")) handleFile(f);
          }}
        >
          <input
            id="step-input"
            type="file"
            accept=".stl"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {file ? (
            <div>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📦</div>
              <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "4px" }}>{file.name}</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{fileSizeMb} MB</p>
              <p style={{ fontSize: "11px", color: "var(--primary)", marginTop: "8px" }}>
                {text(lang, "Andere Datei wählen", "Choose different file")}
              </p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🔷</div>
              <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                {text(lang, "STL-Datei ablegen oder klicken", "Drop STL file or click")}
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>.stl — max. 100 MB</p>
            </>
          )}
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--danger) 12%, var(--panel))", borderRadius: "8px", fontSize: "12.5px", color: "var(--danger)", marginBottom: "12px" }}>
            ⚠ {error}
          </div>
        )}

        {result && (
          <div style={{ padding: "12px 14px", background: "color-mix(in srgb, var(--success, #22c55e) 12%, var(--panel))", borderRadius: "8px", fontSize: "12.5px", color: "var(--success, #22c55e)", marginBottom: "12px" }}>
            ✓ {text(lang, "Konvertiert", "Converted")} — {result.triangles.toLocaleString()} {text(lang, "Dreiecke", "triangles")}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          disabled={!file || converting}
          onClick={() => void handleConvert()}
        >
          <IconDownload />
          {converting
            ? text(lang, "Konvertiert…", "Converting…")
            : text(lang, "In STEP konvertieren & herunterladen", "Convert to STEP & download")}
        </button>
      </div>

      {/* Right: Info */}
      <div>
        <div className="panel panel-padded" style={{ marginBottom: "16px" }}>
          <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "12px" }}>
            {text(lang, "Was ist STEP?", "What is STEP?")}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "12px" }}>
            {text(
              lang,
              "STEP (ISO 10303) ist das Standard-Austauschformat für CAD-Software. Im Gegensatz zu STL enthält STEP Metadaten und ist für technische Anwendungen besser geeignet.",
              "STEP (ISO 10303) is the standard exchange format for CAD software. Unlike STL, STEP contains metadata and is better suited for technical applications.",
            )}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "✅", label: text(lang, "FreeCAD, Fusion 360, SolidWorks, CATIA", "FreeCAD, Fusion 360, SolidWorks, CATIA") },
              { icon: "📐", label: text(lang, "AP242 Tessellated — kompakt & schnell", "AP242 Tessellated — compact & fast") },
              { icon: "⚡", label: text(lang, "Vollständig browser-seitig, kein Upload nötig", "Fully browser-side, no upload needed") },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "12.5px" }}>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: "14px 16px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>⚠ {text(lang, "Hinweis", "Note")}</p>
          <ul style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "16px", lineHeight: 1.6 }}>
            <li>{text(lang, "Die Geometrie bleibt als Mesh (Tessellierung) erhalten", "Geometry is preserved as mesh (tessellation)")}</li>
            <li>{text(lang, "Keine BREP-Flächen — nicht parametrisch editierbar", "No BREP surfaces — not parametrically editable")}</li>
            <li>{text(lang, "Ideal für Import & Referenzgeometrie", "Ideal for import & reference geometry")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Tools3DPageClient() {
  const { settings } = useMakershelf();
  const lang = settings.language;
  const [activeTool, setActiveTool] = useState<Tool>("stl-to-step");

  const tools: { id: Tool; label: string; emoji: string; desc: string }[] = [
    {
      id: "stl-to-step",
      label: "STL → STEP",
      emoji: "🔷",
      desc: text(lang, "STL in STEP-Format konvertieren", "Convert STL to STEP format"),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(lang, "3D-Druck Tools", "3D Print Tools")}</h1>
          <p className="page-subtitle">{text(lang, "Browser-seitige Werkzeuge für den 3D-Druck", "Browser-side tools for 3D printing")}</p>
        </div>
      </div>

      {/* Tool selector */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActiveTool(tool.id)}
            className={`panel${activeTool === tool.id ? "" : ""}`}
            style={{
              padding: "16px 20px",
              textAlign: "left",
              cursor: "pointer",
              border: `2px solid ${activeTool === tool.id ? "var(--primary)" : "var(--border)"}`,
              borderRadius: "10px",
              background: activeTool === tool.id ? "color-mix(in srgb, var(--primary) 8%, var(--panel))" : "var(--panel)",
              minWidth: "160px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>{tool.emoji}</div>
            <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "2px" }}>{tool.label}</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tool.desc}</p>
          </button>
        ))}
      </div>

      {/* Active tool */}
      {activeTool === "stl-to-step" && <StlToStepTool lang={lang} />}
    </div>
  );
}
