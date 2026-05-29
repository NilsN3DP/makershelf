"use client";

export function FileUploader() {
  return (
    <section className="rounded-[28px] border border-dashed border-orange-300 bg-orange-50/70 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-950">
            Drag & drop your print files
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Unterstützte Formate: STL, OBJ, 3MF, STEP, GCODE, AMF, PLY.
            Später kann hier ein echter Upload an NAS, S3 oder Base44 hängen.
          </p>
        </div>
        <button className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600">
          Select files
        </button>
      </div>
    </section>
  );
}
