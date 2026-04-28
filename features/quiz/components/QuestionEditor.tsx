'use client';

import { useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useQuizDraftStore,
  QuestionType,
  type QuestionDraft,
} from '@/features/quiz/store/useQuizDraftStore';
import { OptionItem } from '@/features/quiz/components/OptionItem';
import { useAutoSave } from '@/features/quiz/hooks/useAutoSave';
import { useOptionCorrectLogic } from '@/features/quiz/hooks/useOptionCorrectLogic';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QuestionEditorProps {
  quizId: string;
  question: QuestionDraft;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: QuestionType.MCQ, label: 'Multiple Choice' },
  { value: QuestionType.TRUE_FALSE, label: 'True/False' },
  { value: QuestionType.MULTI_SELECT, label: 'Multi Select' },
  { value: QuestionType.FILL_IN_THE_BLANK, label: 'Fill in the Blank' },
];

/**
 * QuestionEditor
 *
 * Handles editing a single quiz question with:
 * - Question text editing (autosaved)
 * - Type selection (autosaved)
 * - Points and time limit (autosaved)
 * - Option management (autosaved)
 *
 * Architecture:
 * - Add Question → local only (no backend call)
 * - Edit any field → triggers debounced autosave (1s)
 * - Autosave handles CREATE for temp IDs, UPDATE for real IDs
 * - Options are saved together with their parent question
 */
export function QuestionEditor({ quizId, question }: QuestionEditorProps) {
  const updateQuestion = useQuizDraftStore(state => state.updateQuestion);
  const updateOption = useQuizDraftStore(state => state.updateOption);
  const addOption = useQuizDraftStore(state => state.addOption);
  const removeOption = useQuizDraftStore(state => state.removeOption);
  const { scheduleAutoSave, triggerImmediateSave } = useAutoSave(quizId);
  const { setCorrectOption } = useOptionCorrectLogic();

  const options = Object.values(question.options);

  /**
   * Handle correct toggle for an option - triggers immediate save
   */
  const handleOptionCorrectToggle = useCallback(
    (optionId: string, newIsCorrect: boolean) => {
      setCorrectOption(question.id, optionId, newIsCorrect);
      triggerImmediateSave(question.id);
    },
    [question.id, setCorrectOption, triggerImmediateSave]
  );

  // Trigger autosave when question becomes dirty
  useEffect(() => {
    if (question.isDirty && !question.isSaving) {
      scheduleAutoSave(question.id);
    }
  }, [question.isDirty, question.isSaving, question.id, scheduleAutoSave]);

  /**
   * Handle question text change
   */
  const handleQuestionTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    updateQuestion(question.id, { questionText: newText });
  };

  /**
   * Handle type change - trigger immediate save
   */
  const handleTypeChange = (value: string) => {
    const newType = Number(value) as QuestionType;
    updateQuestion(question.id, { type: newType });
    triggerImmediateSave(question.id);
  };

  /**
   * Handle points change
   */
  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const points = Number(e.target.value);
    updateQuestion(question.id, { points });
  };

  /**
   * Handle time limit change
   */
  const handleTimeLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeLimit = Number(e.target.value);
    updateQuestion(question.id, { timeLimit });
  };

  /**
   * Add a new option to the question
   */
  const handleAddOption = useCallback(() => {
    addOption(question.id);
    // Options will be autosaved via the question's dirty state
  }, [addOption, question.id]);

  /**
   * Delete an option
   */
  const handleDeleteOption = useCallback(
    async (optionId: string) => {
      if (optionId.startsWith('temp_')) {
        removeOption(question.id, optionId);
        return;
      }

      await apiClient(`/api/v1/quizzes/options/${optionId}`, {
        method: 'DELETE',
      });

      removeOption(question.id, optionId);
    },
    [question.id, removeOption]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="text-muted-foreground">Question</span>
            {question.isDirty && <Badge variant="outline">Unsaved</Badge>}
            {question.isSaving && <Badge variant="secondary">Saving...</Badge>}
            {question.error && <Badge variant="destructive">Error</Badge>}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Question Text */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Question Text
          </label>
          <Input
            value={question.questionText}
            onChange={handleQuestionTextChange}
            placeholder="Enter your question"
          />
        </div>

        {/* Type, Points, Time Limit */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select
              value={
                question.type !== undefined ? String(question.type) : undefined
              }
              onValueChange={handleTypeChange}
            >
              <SelectTrigger className="w-full max-w-48">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {QUESTION_TYPES.map(type => (
                    <SelectItem key={type.value} value={String(type.value)}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Points
            </label>
            <Input
              type="number"
              min={1}
              value={question.points}
              onChange={handlePointsChange}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Time Limit (seconds)
            </label>
            <Input
              type="number"
              min={1}
              value={question.timeLimit}
              onChange={handleTimeLimitChange}
            />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Options
            </label>
            <Button variant="ghost" size="sm" onClick={handleAddOption}>
              Add Option
            </Button>
          </div>

          <div className="space-y-2">
            {options.map(option => (
              <OptionItem
                key={option.id}
                questionId={question.id}
                option={option}
                questionType={question.type}
                onDelete={handleDeleteOption}
                onCorrectToggle={() =>
                  handleOptionCorrectToggle(option.id, !option.isCorrect)
                }
              />
            ))}

            {options.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No options yet. Click &quot;Add Option&quot; to create one.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
