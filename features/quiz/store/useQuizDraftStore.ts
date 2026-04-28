import { create } from 'zustand';

export type OptionDraft = {
  id: string;
  optionText: string;
  isCorrect: boolean;
  isDirty: boolean; // Indicates if the option has unsaved changes
};

export enum QuestionType {
  MCQ,
  TRUE_FALSE,
  MULTI_SELECT,
  FILL_IN_THE_BLANK,
}

export type QuestionDraft = {
  id: string;
  questionText: string;
  points: number;
  timeLimit: number;
  type: QuestionType;
  prevOrder?: string; // For ordering questions
  nextOrder?: string; // For ordering questions

  options: Record<string, OptionDraft>; // Map of optionId to OptionDraft

  isDirty: boolean; // Indicates if the question has unsaved changes
  isSaving: boolean; // Indicates if the question is currently being saved
  error: boolean; // Indicates if there was an error during the last save attempt
};

type quiz = {
  id: string;
  title: string;
  description?: string | null;
  isPublished: boolean;
  createdBy: string;
  questions: QuestionDraft[];
};

type QuizDraftState = {
  quizId: string | null;
  questions: Record<string, QuestionDraft>; // Map of questionId to QuestionDraft

  setQuiz: (quiz: quiz) => void;

  updateQuestion: (id: string, data: Partial<QuestionDraft>) => void;

  updateOption: (
    questionId: string,
    optionId: string,
    data: Partial<OptionDraft>
  ) => void;
  removeOption: (questionId: string, optionId: string) => void;

  addQuestion: (quizId: string) => void;
  addOption: (questionId: string) => void;

  markSaving: (ids: string[]) => void;
  markSaved: (ids: string[]) => void;
  markError: (ids: string[]) => void;

  reconcileQuestionId: (tempId: string, realId: string) => void;

  reconcileOptionId: (
    questionId: string,
    tempId: string,
    realId: string
  ) => void;
};

export const useQuizDraftStore = create<QuizDraftState>(set => ({
  quizId: null,
  questions: {},

  setQuiz: quiz => {
    const normalizedQuestions: Record<string, QuestionDraft> = {};

    quiz.questions.forEach((q: QuestionDraft) => {
      const optionsMap: Record<string, OptionDraft> = {};
      Object.values(q.options).forEach((opt: OptionDraft) => {
        optionsMap[opt.id] = {
          ...opt,
          isDirty: false,
        };
      });
      normalizedQuestions[q.id] = {
        ...q,
        options: optionsMap,
        isDirty: false,
        isSaving: false,
        error: false,
      };
    });

    set({
      quizId: quiz.id,
      questions: normalizedQuestions,
    });
  },

  updateQuestion: (id, data) => {
    set(state => ({
      questions: {
        ...state.questions,
        [id]: {
          ...state.questions[id],
          ...data,
          isDirty: true,
        },
      },
    }));
  },

  updateOption: (questionId, optionId, data) => {
    set(state => {
      const question = state.questions[questionId];
      return {
        questions: {
          ...state.questions,
          [questionId]: {
            ...question,
            options: {
              ...question.options,
              [optionId]: {
                ...question.options[optionId],
                ...data,
                isDirty: true,
              },
            },
          },
        },
      };
    });
  },

  removeOption: (questionId, optionId) => {
    set(state => {
      const question = state.questions[questionId];
      if (!question || !question.options[optionId]) return state;

      const nextOptions = { ...question.options };
      delete nextOptions[optionId];

      return {
        questions: {
          ...state.questions,
          [questionId]: {
            ...question,
            options: nextOptions,
          },
        },
      };
    });
  },

  addQuestion: (questionId: string) => {
    const opt1 = `temp_${crypto.randomUUID()}`;
    const opt2 = `temp_${crypto.randomUUID()}`;
    set(state => ({
      questions: {
        ...state.questions,
        [questionId]: {
          id: questionId,
          questionText: 'New Question',
          points: 1,
          timeLimit: 30,
          type: QuestionType.MCQ,
          options: {
            [opt1]: {
              id: opt1,
              optionText: 'Option 1',
              isCorrect: false,
              isDirty: true,
            },
            [opt2]: {
              id: opt2,
              optionText: 'Option 2',
              isCorrect: false,
              isDirty: true,
            },
          },
          isDirty: true,
          isSaving: false,
          error: false,
        },
      },
    }));
  },
  addOption: questionId => {
    const id = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    set(state => {
      const q = state.questions[questionId];

      return {
        questions: {
          ...state.questions,
          [questionId]: {
            ...q,
            options: {
              ...q.options,
              [id]: {
                id,
                optionText: '',
                isCorrect: false,
                isDirty: true,
              },
            },
            isDirty: true,
          },
        },
      };
    });
  },

  markSaving: ids => {
    set(state => {
      const updated = { ...state.questions };

      ids.forEach(id => {
        updated[id].isSaving = true;
      });

      return { questions: updated };
    });
  },

  markSaved: ids => {
    set(state => {
      const updated = { ...state.questions };

      ids.forEach(id => {
        updated[id].isDirty = false;
        updated[id].isSaving = false;
        updated[id].error = false;
      });

      return { questions: updated };
    });
  },

  markError: ids => {
    set(state => {
      const updated = { ...state.questions };

      ids.forEach(id => {
        updated[id].error = true;
        updated[id].isSaving = false;
      });

      return { questions: updated };
    });
  },

  reconcileQuestionId: (tempId: string, realId: string) => {
    set(state => {
      const temp = state.questions[tempId];
      if (!temp) return state;

      const newQuestions = { ...state.questions };
      delete newQuestions[tempId];

      newQuestions[realId] = {
        ...temp,
        id: realId,
        isDirty: false,
      };

      return { questions: newQuestions };
    });
  },

  reconcileOptionId: (questionId, tempId, realId) => {
    set(state => {
      const question = state.questions[questionId];
      if (!question) return state;

      const tempOption = question.options[tempId];
      if (!tempOption) return state;

      // Create new options map with reconciled ID
      const newOptions = { ...question.options };
      delete newOptions[tempId];
      newOptions[realId] = {
        ...tempOption,
        id: realId,
        isDirty: false,
      };

      return {
        questions: {
          ...state.questions,
          [questionId]: {
            ...question,
            options: newOptions,
          },
        },
      };
    });
  },
}));
