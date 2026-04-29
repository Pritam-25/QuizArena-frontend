'use client';

import { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CorrectToggle } from './CorrectToggle';
import { useQuizDraftStore } from '../store/useQuizDraftStore';
import { Trash2 } from 'lucide-react';

interface OptionItemProps {
  optionId: string;
  questionId: string;
  onDelete: (optionId: string) => void;
  onCorrectToggle: (optionId: string, newIsCorrect: boolean) => void;
}

/**
 * OptionItem
 *
 * Fully self-contained option renderer. Subscribes internally to only
 * its own slice of the store (`questions[questionId].options[optionId]`)
 * so that editing option A does NOT cause option B to re-render.
 *
 * Wrapped in React.memo — because it now only receives stable string IDs
 * and stable callback refs as props, memo correctly bails out for all
 * unaffected siblings on every Zustand update.
 */
const OptionItemInner = ({
  optionId,
  questionId,
  onDelete,
  onCorrectToggle,
}: OptionItemProps) => {
  const option = useQuizDraftStore(
    state => state.questions[questionId]?.options[optionId]
  );

  const updateOption = useQuizDraftStore(state => state.updateOption);

  // Option may have been removed from the store (delete path) — render nothing.
  if (!option) return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateOption(questionId, optionId, { optionText: e.target.value });
  };

  const handleCorrectToggle = () => {
    onCorrectToggle(optionId, !option.isCorrect);
  };

  return (
    <Card className="relative">
      <CardContent className="flex items-center gap-3 py-3">
        {/* Correct toggle - on the left (fixed width) */}
        <div className="shrink-0 w-8">
          <CorrectToggle
            isCorrect={option.isCorrect}
            onToggle={handleCorrectToggle}
          />
        </div>

        {/* Option text input */}
        <Input
          value={option.optionText}
          onChange={handleTextChange}
          placeholder="Enter option text"
          className="flex-1 min-w-0"
        />

        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(optionId)}
          aria-label="Delete option"
          className="shrink-0"
        >
          <Trash2 size={16} />
        </Button>
      </CardContent>
    </Card>
  );
};

export const OptionItem = memo(OptionItemInner);
