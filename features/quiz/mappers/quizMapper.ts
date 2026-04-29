import { QuestionDraft, OptionDraft } from '../store/useQuizDraftStore';
import { QuestionType } from '../store/useQuizDraftStore';
import { GetQuizzesAdminId200Data } from '@/api/model';

function toQuestionType(value: string): QuestionType {
  switch (value) {
    case 'MCQ':
      return QuestionType.MCQ;
    case 'TRUE_FALSE':
      return QuestionType.TRUE_FALSE;
    case 'MULTI_SELECT':
      return QuestionType.MULTI_SELECT;
    case 'FILL_IN_THE_BLANK':
      return QuestionType.FILL_IN_THE_BLANK;
    default:
      return QuestionType.MCQ;
  }
}

export function mapQuizToDraft(quiz: GetQuizzesAdminId200Data) {
  const questions: Record<string, QuestionDraft> = {};

  (quiz.questions ?? []).forEach(q => {
    const options: Record<string, OptionDraft> = {};

    (q.options ?? []).forEach(opt => {
      options[opt.id] = {
        ...opt,
        isDirty: false,
      };
    });

    questions[q.id] = {
      id: q.id,
      questionText: q.questionText,
      points: q.points,
      timeLimit: q.timeLimit,
      type: toQuestionType(String(q.type)),
      prevOrder: undefined,
      nextOrder: undefined,

      options,

      isDirty: false,
      isSaving: false,
      error: false,
    };
  });

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    isPublished: quiz.isPublished,
    createdBy: quiz.createdBy,
    questions: Object.values(questions),
  };
}
