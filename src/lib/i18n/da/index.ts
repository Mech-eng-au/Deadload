import type { Messages } from '../index.js';
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
 * Dansk (docs/SPEC.md §16).
 *
 * Typet som `Messages`, som er `typeof en`. Det er hele kontrollen: en nøgle der
 * mangler, en nøgle for meget, eller en beskedfunktion med forkerte argumenter
 * er en oversættelsesfejl på oversættelsestidspunktet i stedet for et
 * `undefined` på en telefon.
 *
 * Øvelsernes navne og anvisninger er **ikke** oversat og bliver på engelsk. De
 * er data fra free-exercise-db, ikke tekst vi har skrevet, og §16 forklarer
 * hvorfor — sømmen til at oversætte dem senere ligger i
 * `src/lib/catalog/names.ts` og koster ingenting før nogen bruger den.
 */
export const da: Messages = {
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
