'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useQuizDraftStore,
  QuestionType,
} from '@/features/quiz/store/useQuizDraftStore';

interface QuestionFieldsProps {
  questionId: string;
  onTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTypeChange: (value: string) => void;
  onPointsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTimeLimitChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: QuestionType.MCQ, label: 'Multiple Choice' },
  { value: QuestionType.TRUE_FALSE, label: 'True/False' },
  { value: QuestionType.MULTI_SELECT, label: 'Multi Select' },
  { value: QuestionType.FILL_IN_THE_BLANK, label: 'Fill in the Blank' },
];

/**
 * QuestionFields
 *
 * Renders the question text input, type selector, points and time limit.
 * Each field subscribes to exactly the slice it renders — typing in the
 * text box does NOT cause points or time-limit inputs to re-render.
 */
export function QuestionFields({
  questionId,
  onTextChange,
  onTypeChange,
  onPointsChange,
  onTimeLimitChange,
}: QuestionFieldsProps) {
  const questionText = useQuizDraftStore(
    state => state.questions[questionId]?.questionText ?? ''
  );
  const points = useQuizDraftStore(
    state => state.questions[questionId]?.points ?? 1
  );
  const timeLimit = useQuizDraftStore(
    state => state.questions[questionId]?.timeLimit ?? 30
  );
  const type = useQuizDraftStore(state => state.questions[questionId]?.type);

  return (
    <>
      {/* Question Text */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Question Text
        </label>
        <Input
          value={questionText}
          onChange={onTextChange}
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
            value={type !== undefined ? String(type) : undefined}
            onValueChange={onTypeChange}
          >
            <SelectTrigger className="w-full max-w-48">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {QUESTION_TYPES.map(t => (
                  <SelectItem key={t.value} value={String(t.value)}>
                    {t.label}
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
            value={points}
            onChange={onPointsChange}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Time Limit (seconds)
          </label>
          <Input
            type="number"
            min={1}
            value={timeLimit}
            onChange={onTimeLimitChange}
          />
        </div>
      </div>
    </>
  );
}
