import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CorrectToggle } from './CorrectToggle';
import {
  useQuizDraftStore,
  type OptionDraft,
  QuestionType,
} from '../store/useQuizDraftStore';

interface OptionItemProps {
  questionId: string;
  option: OptionDraft;
  questionType: QuestionType;
  onDelete: (optionId: string) => void;
  onCorrectToggle: () => void;
}

/**
 * OptionItem
 *
 * Renders a single quiz option with:
 * - Editable option text (marked dirty, saved with question)
 * - Correct answer toggle (calls parent callback for save)
 * - Delete button (TODO: implement)
 */
export function OptionItem({
  questionId,
  option,
  questionType,
  onDelete,
  onCorrectToggle,
}: OptionItemProps) {
  const updateOption = useQuizDraftStore(state => state.updateOption);

  /**
   * Handle option text change - marks as dirty for autosave
   */
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    // Update store immediately (optimistic)
    // Parent question's dirty state will trigger autosave
    updateOption(questionId, option.id, { optionText: newText });
  };

  /**
   * Handle correct toggle - triggers immediate save via parent
   */
  const handleCorrectToggle = () => {
    onCorrectToggle();
  };

  return (
    <Card className="relative">
      <CardContent className="flex items-center gap-4 py-3">
        {/* Option text input */}
        <Input
          value={option.optionText}
          onChange={handleTextChange}
          placeholder="Enter option text"
          className="flex-1"
        />

        {/* Correct toggle */}
        <CorrectToggle
          isCorrect={option.isCorrect}
          onToggle={handleCorrectToggle}
        />

        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(option.id)}
          aria-label="Delete option"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </Button>
      </CardContent>
    </Card>
  );
}
