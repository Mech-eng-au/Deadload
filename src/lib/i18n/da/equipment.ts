export const equipment = {
	labels: {
		pull_up_bar: 'Pull-up stang',
		jumping_rope: 'Sjippetov',
		dumbbells: 'Håndvægte',
		kettlebell: 'Kettlebell',
		resistance_band: 'Elastik',
		foam_roller: 'Skumrulle',
		yoga_ball: 'Yogabold',
		suspension_trainer: 'Slyngetræner',
		ab_wheel: 'Maverulle',
		chair: 'Stol eller bænk'
	},
	needs: {
		pull_up_bar: 'En stang i en dørkarm, på væggen eller i loftet, som du kan hænge i.',
		jumping_rope: 'Et sjippetov, og cirka 2 m frihøjde over hovedet.',
		dumbbells: 'En eller et par, uanset vægt.',
		kettlebell: 'En, uanset vægt.',
		resistance_band: 'En løkkeelastik, eller en slangeelastik med håndtag.',
		foam_roller: 'En rulle, til selvmassage-øvelserne.',
		yoga_ball:
			'En stor oppustelig bold, 55–75 cm. Sælges også som trænings-, balance- eller schweizerbold.',
		suspension_trainer: 'To stropper med håndtag, fastgjort til en dør eller en bjælke.',
		ab_wheel: 'Det lille hjul med et håndtag igennem.',
		chair: 'En spisebordsstol, kanten af en sofa eller en seng, et trin, et lavt bord.'
	},
	notes: {
		pull_up_bar:
			'Sat til fra begyndelsen: kataloget har været bygget op om en stang fra starten, og to indbyggede rutiner og én progression har brug for den.',
		chair:
			'Aldrig skjult, og ikke på listen ovenfor: en stol er møbler, ikke et køb. To øvelser er mærket med den — de to dip-varianter — som i kilden er skrevet til parallelle barrer, og to solide stole er sådan de laves derhjemme.'
	},
	exerciseCount: (n: number) => (n === 1 ? '1 øvelse' : `${n} øvelser`),
	noneOwned: 'ingenting — kun gulv, væg og stol'
};
