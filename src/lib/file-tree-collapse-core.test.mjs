import assert from "node:assert/strict";
import test from "node:test";

import { collectTreeFolderPaths } from "./file-tree-collapse-core.js";

test("collectTreeFolderPaths returns every folder path for default collapsed state", () => {
  const tree = {
    path: "",
    children: [
      {
        path: "A",
        children: [
          { path: "A/Sub", children: [] },
        ],
      },
      { path: "B", children: [] },
    ],
  };

  assert.deepEqual(collectTreeFolderPaths(tree), ["A", "A/Sub", "B"]);
});
