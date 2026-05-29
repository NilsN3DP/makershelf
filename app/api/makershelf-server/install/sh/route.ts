import { buildInstallSh } from "@/src/lib/server/installers/makershelf-stack";

export async function GET() {
  return new Response(buildInstallSh(), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
