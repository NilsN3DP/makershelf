import { NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

// ─── STL Parser ───────────────────────────────────────────────────────────────

type Triangle = {
  nx: number; ny: number; nz: number;
  v: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
};

function parseBinaryStl(buf: ArrayBuffer): Triangle[] {
  const view = new DataView(buf);
  const count = view.getUint32(80, true);
  const triangles: Triangle[] = [];
  let offset = 84;
  for (let i = 0; i < count; i++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    triangles.push({
      nx, ny, nz,
      v: [
        [view.getFloat32(offset + 12, true), view.getFloat32(offset + 16, true), view.getFloat32(offset + 20, true)],
        [view.getFloat32(offset + 24, true), view.getFloat32(offset + 28, true), view.getFloat32(offset + 32, true)],
        [view.getFloat32(offset + 36, true), view.getFloat32(offset + 40, true), view.getFloat32(offset + 44, true)],
      ],
    });
    offset += 50;
  }
  return triangles;
}

function parseAsciiStl(text: string): Triangle[] {
  const triangles: Triangle[] = [];
  // Match each facet block
  const facetRe = /facet\s+normal\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)[\s\S]*?vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = facetRe.exec(text)) !== null) {
    triangles.push({
      nx: parseFloat(m[1]), ny: parseFloat(m[2]), nz: parseFloat(m[3]),
      v: [
        [parseFloat(m[4]), parseFloat(m[5]), parseFloat(m[6])],
        [parseFloat(m[7]), parseFloat(m[8]), parseFloat(m[9])],
        [parseFloat(m[10]), parseFloat(m[11]), parseFloat(m[12])],
      ],
    });
  }
  return triangles;
}

function parseStl(buf: ArrayBuffer): Triangle[] {
  // Check if ASCII: first 80 bytes might start with "solid"
  const header = new Uint8Array(buf, 0, Math.min(256, buf.byteLength));
  const text = new TextDecoder("ascii", { fatal: false }).decode(header);
  if (text.trimStart().toLowerCase().startsWith("solid")) {
    const fullText = new TextDecoder("ascii", { fatal: false }).decode(buf);
    const tris = parseAsciiStl(fullText);
    if (tris.length > 0) return tris;
  }
  return parseBinaryStl(buf);
}

// ─── STEP AP242 Tessellated Writer ────────────────────────────────────────────

/**
 * Deduplicate vertices using a string-key map.
 * Returns {vertices: [x,y,z][], indices: number[][]} — indices are 1-based for STEP.
 */
function buildMesh(triangles: Triangle[]): {
  vertices: [number, number, number][];
  faces: [number, number, number][];
} {
  const keyMap = new Map<string, number>();
  const vertices: [number, number, number][] = [];
  const faces: [number, number, number][] = [];

  function getIdx(x: number, y: number, z: number): number {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    let idx = keyMap.get(key);
    if (idx === undefined) {
      idx = vertices.length + 1; // 1-based
      keyMap.set(key, idx);
      vertices.push([x, y, z]);
    }
    return idx;
  }

  for (const tri of triangles) {
    const i1 = getIdx(tri.v[0][0], tri.v[0][1], tri.v[0][2]);
    const i2 = getIdx(tri.v[1][0], tri.v[1][1], tri.v[1][2]);
    const i3 = getIdx(tri.v[2][0], tri.v[2][1], tri.v[2][2]);
    if (i1 !== i2 && i2 !== i3 && i1 !== i3) {
      faces.push([i1, i2, i3]);
    }
  }

  return { vertices, faces };
}

function fmtCoord(v: [number, number, number]): string {
  return `(${v[0].toFixed(6)},${v[1].toFixed(6)},${v[2].toFixed(6)})`;
}

function generateStep(triangles: Triangle[], filename: string): string {
  const { vertices, faces } = buildMesh(triangles);
  const now = new Date().toISOString().slice(0, 19);
  const name = filename.replace(/'/g, "");

  // Chunk coordinates list to avoid very long lines
  const CHUNK = 100;
  const coordChunks: string[] = [];
  for (let i = 0; i < vertices.length; i += CHUNK) {
    coordChunks.push(vertices.slice(i, i + CHUNK).map(fmtCoord).join(",\n    "));
  }
  const coordsBody = coordChunks.join(",\n    ");

  const faceChunks: string[] = [];
  for (let i = 0; i < faces.length; i += CHUNK) {
    faceChunks.push(faces.slice(i, i + CHUNK).map((f) => `(${f[0]},${f[1]},${f[2]})`).join(",\n    "));
  }
  const facesBody = faceChunks.join(",\n    ");

  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('STL to STEP conversion via makershelf'),'2;1');
FILE_NAME('${name}.step','${now}',(''),(''),
  'makershelf STL-to-STEP v1','','');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 3 1 0 0 }'));
ENDSEC;
DATA;
/* Application context */
#1 = APPLICATION_PROTOCOL_DEFINITION('international standard',
  'ap242_managed_model_based_3d_engineering',2011,#2);
#2 = APPLICATION_CONTEXT('managed model based 3d engineering');
/* Product structure */
#3 = PRODUCT('${name}','${name}','',(#4));
#4 = PRODUCT_CONTEXT('',#2,'mechanical');
#5 = PRODUCT_DEFINITION_FORMATION('','',#3);
#6 = PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');
#7 = PRODUCT_DEFINITION('design','',#5,#6);
#8 = PRODUCT_DEFINITION_SHAPE('','',#7);
/* Representation context (mm) */
#9 = (
  GEOMETRIC_REPRESENTATION_CONTEXT(3)
  GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#10))
  GLOBAL_UNIT_ASSIGNED_CONTEXT((#11,#12,#13))
  REPRESENTATION_CONTEXT('3D Context','3D Context with UNIT and UNCERTAINTY')
);
#10 = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#11,
  'distance_accuracy_value','confusion accuracy');
#11 = (LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));
#12 = (NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.));
#13 = (NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT());
/* Tessellated geometry: ${vertices.length} vertices, ${faces.length} triangles */
#14 = COORDINATES_LIST('vertices',3,(
    ${coordsBody}
));
#15 = TRIANGULATED_FACE_SET('triangles',#14,$,(
    ${facesBody}
),$);
#16 = TESSELLATED_SOLID('${name}',(#15),$,$);
#17 = TESSELLATED_SHAPE_REPRESENTATION('',(#16),#9);
#18 = SHAPE_DEFINITION_REPRESENTATION(#8,#17);
ENDSEC;
END-ISO-10303-21;
`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

const MAX_STL_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten." }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "Keine STL-Datei übergeben." }, { status: 400 });
  }

  const ext = fileEntry.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "stl") {
    return NextResponse.json({ error: "Nur STL-Dateien werden unterstützt." }, { status: 400 });
  }

  if (fileEntry.size > MAX_STL_BYTES) {
    return NextResponse.json({ error: "Datei zu groß (max. 100 MB)." }, { status: 400 });
  }

  const buffer = await fileEntry.arrayBuffer();
  let triangles: Triangle[];
  try {
    triangles = parseStl(buffer);
  } catch (err) {
    return NextResponse.json({
      error: `STL-Datei konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 422 });
  }

  if (triangles.length === 0) {
    return NextResponse.json({ error: "STL-Datei enthält keine Dreiecke." }, { status: 422 });
  }

  const baseName = fileEntry.name.replace(/\.stl$/i, "");
  const stepContent = generateStep(triangles, baseName);
  const stepBytes = new TextEncoder().encode(stepContent);

  return new NextResponse(stepBytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/step",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(baseName)}.step"`,
      "X-Triangle-Count": String(triangles.length),
    },
  });
}
