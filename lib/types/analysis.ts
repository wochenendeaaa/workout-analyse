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

export interface CoachBigPicture {
  headline: string;
  watch_outs: string[];
}

export type CoachFollowupQuestionKind = "text" | "scale" | "choice";

export interface CoachFollowupQuestion {
  id: string;
  prompt: string;
  kind: CoachFollowupQuestionKind;
  choices?: string[];
}

export interface CoachFollowup {
  required: boolean;
  reason: string;
  questions: CoachFollowupQuestion[];
}

export interface CoachProfileLocal {
  goal_priority: string;
  recurring_pain_notes: string;
  recovery_notes: string;
  schedule_constraints: string;
  preferred_training_days: string;
}

export interface CoachTrendStats {
  total_sessions_seen: number;
  unique_exercises_seen: number;
  approximate_total_sets: number;
}

export interface CoachMemoryLocal {
  recent_sessions: ExtractedDay[];
  long_term_summary: string;
  trend_stats: CoachTrendStats;
  last_updated_at: string;
}

export interface WorkoutAnalysisResult {
  extracted_data: ExtractedDay[];
  progressive_overload_analysis: string;
  coach_tips: string[];
  alternative_exercises: AlternativeExercise[];
  /** Immer gesetzt nach neuer Analyse; bei importierten Alt-Daten ggf. leer. */
  next_session_prescription: NextSessionPrescriptionItem[];
  /** Optional bei älteren Snapshots. */
  coach_big_picture: CoachBigPicture | null;
  /** Optional bei älteren gespeicherten Snapshots. */
  coach_followup: CoachFollowup | null;
}
