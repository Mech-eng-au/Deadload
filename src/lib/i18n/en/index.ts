import { nav, common } from './common.js';
import { units } from './units.js';
import { home, presets, about } from './home.js';
import { catalog, exercise } from './catalog.js';
import { muscles } from './muscles.js';
import { equipment } from './equipment.js';
import { session, routine } from './session.js';
import { settings } from './settings.js';
import { importer } from './importer.js';
import { history } from './history.js';
import { stats } from './stats.js';
import { pdf } from './pdf.js';

/**
 * English, the base language (docs/SPEC.md §16).
 *
 * This object is the **type** every other locale has to satisfy, so anything
 * added here has to be added everywhere before the project compiles. That is
 * deliberate: a language shipping half-translated is worse than one shipping
 * late, because the gaps only show up on the screens nobody tested.
 */
export const en = {
	nav,
	common,
	units,
	home,
	presets,
	about,
	catalog,
	exercise,
	muscles,
	equipment,
	session,
	routine,
	settings,
	importer,
	history,
	stats,
	pdf
};
