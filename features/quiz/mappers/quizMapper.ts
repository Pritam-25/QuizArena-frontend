import { GetQuizzesId200Data } from '@/api/model/getQuizzesId200Data';
import { QuestionDraft, OptionDraft } from '../store/useQuizDraftStore';
import { QuestionType } from '../store/useQuizDraftStore';

export function mapQuizToDraft(quiz: GetQuizzesId200Data) {
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
      type: q.type as unknown as QuestionType,
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
