"use client";

export function UrlImport() {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">URL import</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Für direkte Download-Links aus CDN, NAS oder externer Bibliothek.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="url"
            placeholder="https://example.com/model.stl"
            className="input-theme h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:bg-white"
          />
          <button className="btn-secondary rounded-2xl px-5 py-3 text-sm font-semibold transition">
            Import link
          </button>
        </div>
      </div>
    </section>
  );
}
