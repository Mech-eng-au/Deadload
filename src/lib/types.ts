// Catalog types per docs/SPEC.md §4.1. Routine/session types arrive in M1.

export type ExerciseId = string; // snake_case slug, e.g. "worlds_greatest_stretch"

export type Category = 'strength' | 'stretch' | 'mobility' | 'core' | 'cardio';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
	id: ExerciseId;
	name: string;
	aliases: string[];
	category: Category;
	primaryMuscles: string[];
	secondaryMuscles: string[];
	level: Level;
	unilateral: boolean;
	defaultMetric: 'reps' | 'duration';
	instructions: string[];
	media: MediaAsset[]; // length >= 1, enforced by build script
	attributionId: string;
}

export interface MediaAsset {
	kind: 'image' | 'video';
	path: string; // "/media/push_up/0.webp"
	caption?: string; // only when the source actually labels the frame; never inferred
	width: number;
	height: number;
}

export interface Attribution {
	id: string;
	source: 'free-exercise-db' | 'wger' | 'wikimedia' | 'own';
	license: 'PD' | 'CC0' | 'CC-BY-SA-3.0' | 'CC-BY-SA-4.0' | 'own';
	author?: string;
	sourceUrl?: string;
}
