import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  turbopack: {
    root: projectRoot,
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: /Encountered unexpected file in NFT list/,
        description: /A file was traced that indicates that the whole project was traced unintentionally\./,
      },
      {
        path: "**/app/api/open-file/route.ts",
        title: /Encountered unexpected file in NFT list/,
        description: /A file was traced that indicates that the whole project was traced unintentionally\./,
      },
    ],
  },
};

export default nextConfig;
