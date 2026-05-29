export function isSafeCoverUrl(url: string): boolean {
  return /^(https?:\/\/|data:image\/)/.test(url);
}
