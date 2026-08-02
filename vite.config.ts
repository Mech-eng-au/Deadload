import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const base = process.env.BASE_PATH ?? '';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			manifest: {
				name: 'Deadload',
				short_name: 'Deadload',
				description: 'Local-first bodyweight training',
				display: 'standalone',
				orientation: 'portrait',
				background_color: '#0a0a0b',
				theme_color: '#0a0a0b',
				start_url: `${base}/`,
				scope: `${base}/`,
				icons: [
					{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
					{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
				]
			},
			workbox: {
				// `ttf` is here for the printable sheet's embedded font (§16). Without
				// it the subsets are the one asset the service worker does not hold, so
				// the PDF button would work everywhere except offline — which is the
				// one place §1 promises everything works. The APK does not register a
				// service worker at all (§11), so this only matters to the hosted PWA,
				// which is exactly why it would never have been noticed on the phone.
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest,ttf}'],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				navigateFallback: null
			}
		})
	]
});
