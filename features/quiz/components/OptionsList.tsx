'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useQuizDraftStore } from '@/features/quiz/store/useQuizDraftStore';
import { OptionItem } from './OptionItem';

interface OptionsListProps {
  questionId: string;
  onAdd: () => void;
  onDelete: (optionId: string) => void;
  onCorrectToggle: (optionId: string, newIsCorrect: boolean) => void;
}

/**
 * OptionsList
 *
 * Renders the list of options for a question. Subscribes directly to the
 * `options` map for this question — only re-renders when options are
 * added or removed (i.e. the map reference changes). Individual option
 * text edits / toggle changes are isolated to each OptionItem.
 *
 * Passes only stable string IDs to OptionItem so React.memo can bail out
 * for unaffected siblings.
 */
export function OptionsList({
  questionId,
  onAdd,
  onDelete,
  onCorrectToggle,
}: OptionsListProps) {
  const optionsMap = useQuizDraftStore(
    state => state.questions[questionId]?.options
  );

  // Derive a stable list of IDs — useMemo ensures the array identity only
  // changes when the map reference changes (i.e. add/remove), not on edits.
  const optionIds = useMemo(
    () => (optionsMap ? Object.keys(optionsMap) : []),
    [optionsMap]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Options
        </label>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          Add Option
        </Button>
      </div>

      <div className="space-y-2">
        {optionIds.map(optionId => (
          <OptionItem
            key={optionId}
            optionId={optionId}
            questionId={questionId}
            onDelete={onDelete}
            onCorrectToggle={onCorrectToggle}
          />
        ))}

        {optionIds.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No options yet. Click &quot;Add Option&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
