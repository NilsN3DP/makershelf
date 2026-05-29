export function isAbsoluteStoragePath(value: string | undefined) {
  const path = value?.trim();
  if (!path) {
    return false;
  }

  return /^[a-zA-Z]:[\\/]/.test(path) || /^\\\\[^\\]+\\[^\\]+/.test(path) || path.startsWith("/");
}

export function needsFixedStoragePath(value: string | undefined) {
  return !isAbsoluteStoragePath(value);
}

