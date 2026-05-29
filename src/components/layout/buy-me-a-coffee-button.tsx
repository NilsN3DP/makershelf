"use client";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";

export function BuyMeACoffeeButton() {
  const { settings } = useMakershelf();
  const supportUrl = settings.buyMeACoffeeUrl || "https://buymeacoffee.com/n3dp";

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noreferrer"
      className="buy-me-a-coffee fixed bottom-4 right-4 z-40 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
    >
      Buy me a coffee
    </a>
  );
}
