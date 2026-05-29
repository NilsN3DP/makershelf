"use client";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";

export function DebugConsole() {
  const { settings, debugLogs } = useMakershelf();

  if (!settings.debugMode) {
    return null;
  }

  return (
    <aside className="fixed bottom-4 left-4 z-50 w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[rgba(5,12,23,0.92)] p-3 text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Debug Console
        </p>
        <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">
          {debugLogs.length} Logs
        </span>
      </div>
      <div className="mt-3 max-h-48 space-y-1 overflow-auto font-mono text-xs">
        {debugLogs.length === 0 ? (
          <p className="text-slate-400">Noch keine Logs.</p>
        ) : (
          debugLogs.map((entry) => (
            <div key={entry.id} className="rounded bg-white/5 px-2 py-1.5">
              <span className={entry.level === "error" ? "text-red-300" : "text-emerald-300"}>
                [{entry.level.toUpperCase()}]
              </span>{" "}
              <span className="text-slate-300">{entry.at}</span>{" "}
              <span>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
