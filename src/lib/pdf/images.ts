import { base } from '$app/paths';
import type { JpegImage } from './writer.js';
import type { Exercise } from '../types.js';

/**
 * Catalog photographs, turned into something a PDF can hold (§8).
 *
 * The only part of the PDF code that touches the browser, and it is here rather
 * than in the sheet because of what a PDF will and will not accept: **JPEG it
 * stores verbatim, WebP it has never heard of**. The catalog ships WebP, so each
 * photograph is decoded, scaled to the size it is actually printed at, and
 * re-encoded — which a canvas does in three lines and a library would not do
 * better.
 *
 * Scaling first is the whole trick for file size. The catalog's images are 800 px
 * wide and 78 kB each; on paper they are 23 mm across, where 240 px is already
 * more than a printer resolves. Twelve of those come to well under 200 kB.
 */

/** Printed width in points, and the pixel width that comfortably covers it. */
export const THUMB_PT = 64;
const THUMB_PX = 240;
const QUALITY = 0.72;

/**
 * The first frame of each exercise, ready for the sheet. Anything that fails to
 * load is simply absent from the map: a routine printed without one photograph is
 * better than a button that does nothing.
 */
export async function loadThumbnails(exercises: Exercise[]): Promise<Map<string, JpegImage>> {
	const out = new Map<string, JpegImage>();
	await Promise.all(
		exercises.map(async (exercise) => {
			const media = exercise.media[0];
			if (!media) return;
			try {
				out.set(exercise.id, await toJpeg(`${base}${media.path}`));
			} catch {
				// Left out on purpose — see above.
			}
		})
	);
	return out;
}

async function toJpeg(url: string): Promise<JpegImage> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} for ${url}`);
	const bitmap = await createImageBitmap(await response.blob());

	const scale = Math.min(1, THUMB_PX / bitmap.width);
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));

	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('no 2d context');
	// White underneath, because a JPEG has no transparency and the paper is white.
	context.fillStyle = '#fff';
	context.fillRect(0, 0, width, height);
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
	return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}
