'use client';

import { Badge } from '@/components/ui/badge';
import { CardTitle } from '@/components/ui/card';
import { useQuizDraftStore } from '@/features/quiz/store/useQuizDraftStore';

interface QuestionHeaderProps {
  questionId: string;
}

/**
 * QuestionHeader
 *
 * Renders only the save-status badges (Unsaved / Saving… / Error).
 * Subscribes to isDirty, isSaving, error independently so it only
 * re-renders when the badge state changes — never on text edits or
 * option changes.
 */
export function QuestionHeader({ questionId }: QuestionHeaderProps) {
  const isDirty = useQuizDraftStore(
    state => state.questions[questionId]?.isDirty ?? false
  );
  const isSaving = useQuizDraftStore(
    state => state.questions[questionId]?.isSaving ?? false
  );
  const error = useQuizDraftStore(
    state => state.questions[questionId]?.error ?? false
  );

  return (
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2">
        <span className="text-muted-foreground">Question</span>
        {isDirty && <Badge variant="outline">Unsaved</Badge>}
        {isSaving && <Badge variant="secondary">Saving...</Badge>}
        {error && <Badge variant="destructive">Error</Badge>}
      </CardTitle>
    </div>
  );
}
