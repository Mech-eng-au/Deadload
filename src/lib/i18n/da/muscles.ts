export const muscles = {
	title: 'Muskler',
	intro:
		'Kataloget navngiver muskler som en anatomibog gør. Her er hver enkelt på almindeligt dansk, og hvor du finder den på dig selv. Tryk på en for at se den på figuren.',
	whatTheyMean: 'Hvad alle de muskelnavne betyder',
	trains: (n: number) => (n === 1 ? '1 øvelse' : `${n} øvelser`),
	assisting: (n: number) => `+${n} hjælper til`,
	showExercises: 'Vis øvelserne der træner den →',
	onlyAssists: 'Intet i dette katalog træner den direkte — den hjælper kun til.',
	onTheFigure: (approximation: string) => `På figuren ${approximation}.`,
	works: 'Arbejder',
	assists: 'Hjælper til',
	withHint: (label: string, short: string) => `${label.toLowerCase()} (${short})`,

	names: {
		abdominals: {
			label: 'Mavemuskler',
			short: 'maven',
			where: 'Forsiden af maven, mellem ribbenene og hofterne.',
			does: 'Bøjer overkroppen fremad, og holder den fra at svaje når du ligger i en planke.'
		},
		abductors: {
			label: 'Abduktorer',
			short: 'ydersiden af hoften',
			where: 'Ydersiden af hoften, på siden af balden.',
			does: 'Fører benet ud til siden, og holder hofterne vandrette når du står på ét ben.'
		},
		adductors: {
			label: 'Adduktorer',
			short: 'inderlår',
			where: 'Inderlåret, op gennem lysken.',
			does: 'Trækker benet ind mod det andet. Det, en bred squat strækker.'
		},
		biceps: {
			label: 'Biceps',
			short: 'forsiden af overarmen',
			where: 'Forsiden af overarmen, mellem skulder og albue.',
			does: 'Bøjer albuen. Laver det meste af det ekstra arbejde i en chin-up frem for en pull-up.'
		},
		calves: {
			label: 'Lægge',
			short: 'bagsiden af underbenet',
			where: 'Bagsiden af underbenet, mellem knæ og hæl.',
			does: 'Strækker foden nedad: hvert skridt, hvert hop, hver tåhævning.'
		},
		chest: {
			label: 'Bryst',
			short: 'forsiden af brystkassen',
			where: 'Hen over forsiden af brystkassen, under kravebenet.',
			does: 'Skubber armene fremad og indad. Hovedmusklen i en armstrækning.'
		},
		forearms: {
			label: 'Underarme',
			short: 'albue til håndled',
			where: 'Mellem albuen og håndleddet, hele vejen rundt.',
			does: 'Grebet, og håndleddet. Som regel det, der giver op først i et langt hæng.'
		},
		glutes: {
			label: 'Balder',
			short: 'bagdelen',
			where: 'Bagdelen, fra toppen af hoften og ned til låret.',
			does: 'Strækker hoften: at rejse sig op af en squat, og hver eneste bro.'
		},
		hamstrings: {
			label: 'Baglår',
			short: 'bagsiden af låret',
			where: 'Bagsiden af låret, fra balden og ned bag knæet.',
			does: 'Bøjer knæet, og hjælper balderne med at strække hoften. Det, en tåberøring strækker.'
		},
		lats: {
			label: 'Lats',
			short: 'siderne af ryggen',
			where: 'Den brede plade ned langs siderne af ryggen, som begynder under armhulen.',
			does: 'Trækker armene ned og ind mod kroppen. Musklen en pull-up i virkeligheden handler om.'
		},
		'lower back': {
			label: 'Lænd',
			short: 'over bæltestedet',
			where: 'På hver side af rygsøjlen, over bæltestedet.',
			does: 'Holder rygsøjlen ret. Spænder mere end den bevæger, og derfor trænes den med hold.'
		},
		'middle back': {
			label: 'Midterste ryg',
			short: 'mellem skulderbladene',
			where: 'Mellem skulderbladene.',
			does: 'Klemmer skulderbladene sammen. Det er den her, ikke armene, en roning træner.'
		},
		neck: {
			label: 'Nakke',
			short: 'for, bag og på siderne',
			where: 'Forsiden, bagsiden og siderne af halsen.',
			does: 'Holder hovedet oppe og drejer det.'
		},
		quadriceps: {
			label: 'Quadriceps',
			short: 'forsiden af låret',
			where: 'Forsiden af låret, fra hoften til knæskallen.',
			does: 'Strækker knæet: squats, udfald og hver eneste trappe.'
		},
		shoulders: {
			label: 'Skuldre',
			short: 'kappen på armen',
			where: 'Kappen der sidder oven på hver arm, foran, på siden og bagpå.',
			does: 'Løfter armen i enhver retning, og over hovedet mest af alt.'
		},
		traps: {
			label: 'Traps',
			short: 'nakke til skuldre',
			where: 'Fra nakken ud til hver skulder, og ned mellem skulderbladene.',
			does: 'Trækker skuldrene op, og holder skulderbladene tilbage og nede.'
		},
		triceps: {
			label: 'Triceps',
			short: 'bagsiden af overarmen',
			where: 'Bagsiden af overarmen, mellem skulder og albue.',
			does: 'Strækker albuen: armstrækninger, dips og ethvert pres.'
		}
	},

	approximated: {
		lats: 'deler området for øvre ryg med den midterste ryg',
		'middle back': 'deler området for øvre ryg med lats',
		abductors: 'er vist på balderne, hvor gluteus medius faktisk sidder'
	}
};
