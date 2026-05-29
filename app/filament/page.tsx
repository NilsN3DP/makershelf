import { FilamentPageClient } from "@/src/components/filament/filament-page-client";

type Props = {
  searchParams: Promise<{ spool?: string }>;
};

export default async function FilamentPage({ searchParams }: Props) {
  const { spool } = await searchParams;
  return <FilamentPageClient initialSpoolId={spool} />;
}
