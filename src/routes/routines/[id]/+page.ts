// Routine ids are user data, so these pages cannot be prerendered; the static
// adapter's SPA fallback serves them and the data is read from IndexedDB.
export const prerender = false;
export const ssr = false;
