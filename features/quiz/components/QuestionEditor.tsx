'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  useQuizDraftStore,
  QuestionType,
} from '@/features/quiz/store/useQuizDraftStore';
import { QuestionHeader } from '@/features/quiz/components/QuestionHeader';
import { QuestionFields } from '@/features/quiz/components/QuestionFields';
import { OptionsList } from '@/features/quiz/components/OptionsList';
import { useAutoSave } from '@/features/quiz/hooks/useAutoSave';
import { useQuestionAutosaveTrigger } from '@/features/quiz/hooks/useQuestionAutosaveTrigger';
import { useOptionCorrectLogic } from '@/features/quiz/hooks/useOptionCorrectLogic';
import { useDeleteQuizzesOptionsOptionId } from '@/api/quiz/quiz';
import { handleError } from '@/lib/api/handleError';

interface QuestionEditorProps {
  quizId: string;
  questionId: string;
}

/**
 * QuestionEditor
 *
 * Thin shell that wires together action handlers and delegates all
 * rendering to focused sub-components (QuestionHeader, QuestionFields,
 * OptionsList). Each sub-component subscribes only to the slice of state
 * it needs — this component itself holds NO Zustand subscriptions beyond
 * stable action refs, so it never re-renders due to state changes.
 *
 * Architecture:
 * - Add Question  → local only (no backend call)
 * - Edit any field → triggers debounced autosave (2 s) via useQuestionAutosaveTrigger
 * - Autosave handles CREATE for temp IDs, UPDATE for real IDs
 * - Options are saved together with their parent question
 */
export function QuestionEditor({ quizId, questionId }: QuestionEditorProps) {
  // Only stable action refs — no reactive subscriptions in this shell
  const updateQuestion = useQuizDraftStore(state => state.updateQuestion);
  const addOption = useQuizDraftStore(state => state.addOption);
  const removeOption = useQuizDraftStore(state => state.removeOption);

  const { scheduleAutoSave, triggerImmediateSave } = useAutoSave(quizId);
  const { setCorrectOption } = useOptionCorrectLogic();
  const { mutateAsync: deleteOption } = useDeleteQuizzesOptionsOptionId();

  // Autosave trigger effects live here — granular selectors + queue guard
  useQuestionAutosaveTrigger(questionId, scheduleAutoSave);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleQuestionTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateQuestion(questionId, { questionText: e.target.value });
    },
    [questionId, updateQuestion]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = Number(value) as QuestionType;
      updateQuestion(questionId, { type: newType });
      triggerImmediateSave(questionId);
    },
    [questionId, updateQuestion, triggerImmediateSave]
  );

  const handlePointsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateQuestion(questionId, { points: Number(e.target.value) });
    },
    [questionId, updateQuestion]
  );

  const handleTimeLimitChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateQuestion(questionId, { timeLimit: Number(e.target.value) });
    },
    [questionId, updateQuestion]
  );

  const handleAddOption = useCallback(() => {
    addOption(questionId);
  }, [addOption, questionId]);

  const handleOptionCorrectToggle = useCallback(
    (optionId: string, newIsCorrect: boolean) => {
      setCorrectOption(questionId, optionId, newIsCorrect);
    },
    [questionId, setCorrectOption]
  );

  const handleDeleteOption = useCallback(
    async (optionId: string) => {
      // Temp options: local-only removal, no API call needed
      if (optionId.startsWith('temp_')) {
        removeOption(questionId, optionId);
        return;
      }

      // Optimistically remove from local store immediately
      removeOption(questionId, optionId);
      try {
        await deleteOption({ optionId });
      } catch (error) {
        // Optionally: rollback here if needed (requires original option data)
        console.error('Failed to delete option:', error);
        handleError(error);
      }
    },
    [questionId, removeOption, deleteOption]
  );

  return (
    <Card>
      <CardHeader>
        <QuestionHeader questionId={questionId} />
      </CardHeader>
      <CardContent className="space-y-4">
        <QuestionFields
          questionId={questionId}
          onTextChange={handleQuestionTextChange}
          onTypeChange={handleTypeChange}
          onPointsChange={handlePointsChange}
          onTimeLimitChange={handleTimeLimitChange}
        />
        <OptionsList
          questionId={questionId}
          onAdd={handleAddOption}
          onDelete={handleDeleteOption}
          onCorrectToggle={handleOptionCorrectToggle}
        />
      </CardContent>
    </Card>
  );
}
