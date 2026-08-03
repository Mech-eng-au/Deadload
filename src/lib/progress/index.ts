/**
 * Progression (docs/SPEC.md §17). Pure rules over the session log and the
 * routine, per §15: data arrives as arguments, nothing here reads the database,
 * and every rule is unit-tested.
 *
 * Two halves, and the second depends on the first:
 *
 * - `calibration.ts` — §17.2's window. The first sessions on a newly introduced
 *   exercise measure skill rather than strength, so they are recorded and then
 *   excluded from the criterion below, from §10's sparkline, and from anything
 *   the app says about getting stronger.
 * - `offer.ts` — §17.1's criterion and what is offered when it is met.
 *
 * Nothing here applies anything. §17.3: the routine is the user's, and every
 * offer waits for a tap.
 */
export {
	CALIBRATION_SESSIONS,
	CALIBRATION_SESSIONS_ADVANCED,
	calibratingSessions,
	calibrationWindow,
	isCalibrating,
	performedIn
} from './calibration.js';

export {
	DECLINE_DAYS,
	MAX_OFFERS_PER_SESSION,
	REP_CEILING,
	STARTING_RANGE,
	STREAK_SESSIONS,
	applies,
	applyOffer,
	declineOffer,
	offerFor,
	offersFor,
	targetTop,
	type Offer,
	type OfferInput
} from './offer.js';
