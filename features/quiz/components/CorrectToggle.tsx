import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CorrectToggleProps {
  isCorrect: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * CorrectToggle
 *
 * Toggle button for marking an option as the correct answer.
 * Uses shadcn/ui Button with theme tokens only.
 */
export function CorrectToggle({
  isCorrect,
  onToggle,
  disabled,
}: CorrectToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {isCorrect && <Badge variant="secondary">Correct</Badge>}
      <Button
        type="button"
        variant={isCorrect ? 'default' : 'outline'}
        size="sm"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={isCorrect}
        aria-label={isCorrect ? 'Mark as incorrect' : 'Mark as correct'}
      >
        {isCorrect ? 'Correct' : 'Set Correct'}
      </Button>
    </div>
  );
}
