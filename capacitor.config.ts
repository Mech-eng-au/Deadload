import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Packages the static SvelteKit build into an Android APK (docs/SPEC.md §11).
 * The web assets ship inside the APK, so the app needs no hosting and works
 * offline from first launch — the service worker is not used in this build.
 */
const config: CapacitorConfig = {
	appId: 'app.deadload',
	appName: 'Deadload',
	webDir: 'build',
	android: {
		backgroundColor: '#0a0a0b'
	}
};

export default config;
