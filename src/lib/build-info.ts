/**
 * Which build is this? Stamped by CI into the web bundle (see
 * .github/workflows/android.yml), so the phone can always answer the question
 * "did the update actually install?". Local dev builds have no stamp.
 */

const number = import.meta.env.VITE_BUILD_NUMBER as string | undefined;
const sha = import.meta.env.VITE_BUILD_SHA as string | undefined;
const date = import.meta.env.VITE_BUILD_DATE as string | undefined;

/** "0.1.25 · 36d50dd · 2026-07-28", or "dev" outside CI. */
export const BUILD_LABEL = number
	? ['0.1.' + number, sha?.slice(0, 7), date].filter(Boolean).join(' · ')
	: 'dev';
