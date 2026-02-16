/**
 * In-memory handoff from hero (home) to mix page. Avoids IndexedDB for the redirect,
 * which is unreliable on some mobile browsers. Used with client-side navigation (router.push).
 */
let pending: File[] = [];

export function setHeroPendingFiles(files: File[]): void {
  pending = files.length > 0 ? [...files] : [];
}

export function getHeroPendingFiles(): File[] {
  const out = pending;
  pending = [];
  return out;
}
