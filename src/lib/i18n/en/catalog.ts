import { formatters } from '../format.js';

const f = formatters('en-GB');

export const catalog = {
	title: 'Catalog',
	search: (n: number) => `Search ${f.num(n)} exercises…`,
	all: 'all',
	categories: {
		strength: 'strength',
		stretch: 'stretch',
		mobility: 'mobility',
		core: 'core',
		cardio: 'cardio'
	},
	levels: {
		beginner: 'beginner',
		intermediate: 'intermediate',
		advanced: 'advanced'
	},
	shown: (n: number) => `${f.num(n)} shown`,
	needEquipment: (n: number) => `${f.num(n)} need equipment you have not ticked`,
	nothingMatches: 'Nothing matches. Try a different name — or clear the category filter.',
	moreHidden: (n: number) => `${f.num(n)} more are hidden until you tick the equipment.`
};

export const exercise = {
	howToDoIt: 'How to do it',
	/**
	 * Instructions come from free-exercise-db and stay English (§16). Said once,
	 * on the screen that shows them, rather than left for the reader to work out.
	 */
	instructionsInEnglish: 'The step-by-step cues are in English, from the exercise catalog.',
	progression: 'Progression',
	needsEquipment: (equipment: string) => `Needs ${equipment}, which you have not ticked.`,
	tickInSettings: 'Tick it in Settings',
	swapPhoto: 'Swap photo, double tap to play',
	playing: 'playing · double tap to stop',
	frameOf: (n: number, total: number) => `${n}/${total} · double tap to play`,
	notFound: 'That exercise is not in the catalog.'
};
