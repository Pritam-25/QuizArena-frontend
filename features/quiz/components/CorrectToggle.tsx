import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface CorrectToggleProps {
  isCorrect: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * CorrectToggle
 *
 * Toggle button for marking an option as the correct answer.
 * Uses shadcn/ui RadioGroupItem as a single toggle.
 */
export function CorrectToggle({
  isCorrect,
  onToggle,
  disabled,
}: CorrectToggleProps) {
  return (
    <RadioGroup
      value={isCorrect ? 'correct' : 'none'}
      onValueChange={onToggle}
      disabled={disabled}
      className="w-fit"
    >
      <RadioGroupItem
        value="correct"
        aria-label={isCorrect ? 'Mark as incorrect' : 'Mark as correct'}
      />
    </RadioGroup>
  );
}
