export interface ExtractedExercise {
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

export interface ExtractedDay {
  date: string;
  exercises: ExtractedExercise[];
}

export interface AlternativeExercise {
  original: string;
  alternative: string;
  reason: string;
}

/** Konkrete Vorschläge für die nächste Session (Sätze, Reps, Gewicht). */
export interface NextSessionPrescriptionItem {
  exercise_name: string;
  target_sets: string;
  target_reps: string;
  suggested_weight: string;
  rationale: string;
}

export interface WorkoutAnalysisResult {
  extracted_data: ExtractedDay[];
  progressive_overload_analysis: string;
  coach_tips: string[];
  alternative_exercises: AlternativeExercise[];
  /** Immer gesetzt nach neuer Analyse; bei importierten Alt-Daten ggf. leer. */
  next_session_prescription: NextSessionPrescriptionItem[];
}
