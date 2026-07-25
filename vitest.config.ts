import { defineConfig } from 'vitest/config';

// Deliberately does not load the SvelteKit plugin: the db, import and resolver
// layers are plain TypeScript and must stay testable headlessly (§15).
export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
