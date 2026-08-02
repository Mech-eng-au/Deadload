/**
 * The equipment table's words (§5.1).
 *
 * Moved out of `src/lib/catalog/equipment.ts` on 2026-08-02 by §16, on the same
 * split as the muscles: that file keeps the ids, which are gated, and the
 * counting; this one keeps the label, the sentence that lets somebody answer
 * the question, and the one-line notes.
 */
export const equipment = {
	labels: {
		pull_up_bar: 'Pull-up bar',
		jumping_rope: 'Jumping rope',
		dumbbells: 'Dumbbells',
		kettlebell: 'Kettlebell',
		resistance_band: 'Resistance band',
		foam_roller: 'Foam roller',
		yoga_ball: 'Yoga ball',
		suspension_trainer: 'Suspension straps',
		ab_wheel: 'Ab wheel',
		chair: 'Chair or bench'
	},
	needs: {
		pull_up_bar: 'A doorway, wall or ceiling bar you can hang from.',
		jumping_rope: 'A skipping rope, and about 2 m of clearance overhead.',
		dumbbells: 'One or a pair, any weight.',
		kettlebell: 'One, any weight.',
		resistance_band: 'A loop band, or a tube band with handles.',
		foam_roller: 'A roller, for the self-massage entries.',
		yoga_ball: 'A big inflatable ball, 55–75 cm. Also sold as an exercise, stability or Swiss ball.',
		suspension_trainer: 'Two straps with handles, anchored to a door or a beam.',
		ab_wheel: 'The small wheel with a handle through it.',
		chair: 'A dining chair, the edge of a sofa or bed, a step, a low table.'
	},
	notes: {
		pull_up_bar:
			'Ticked to begin with: the catalog has been built around a bar since the start, and two presets and one progression need it.',
		chair:
			'Never hidden, and not in the list above: a chair is furniture, not a purchase. Two exercises tagged with it — the two dip variants — are written for parallel bars in the source, and two sturdy chairs are how they are done at home.'
	},
	/** "1 exercise" / "14 exercises" — the count is shown even when it is 1 (§5.1). */
	exerciseCount: (n: number) => (n === 1 ? '1 exercise' : `${n} exercises`),
	noneOwned: 'none — floor, wall and chair only'
};
