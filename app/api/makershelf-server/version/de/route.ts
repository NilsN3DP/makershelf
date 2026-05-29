import { renderVersionPage } from "@/app/api/makershelf-server/version/route";

export async function GET(request: Request) {
  return renderVersionPage(request, "de");
}
