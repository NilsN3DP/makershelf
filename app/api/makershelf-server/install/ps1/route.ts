import { buildInstallPs1 } from "@/src/lib/server/installers/makershelf-stack";

export async function GET() {
  return new Response(buildInstallPs1(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
