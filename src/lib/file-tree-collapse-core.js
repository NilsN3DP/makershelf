export function collectTreeFolderPaths(node) {
  return node.children.flatMap((child) => [child.path, ...collectTreeFolderPaths(child)]);
}
