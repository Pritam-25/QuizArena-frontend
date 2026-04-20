import { useQuizDraftStore } from '../store/useQuizDraftStore';

export const useDirtyQuestions = () => {
  const questions = useQuizDraftStore(state => state.questions);
  return Object.values(questions).filter(q => q.isDirty);
};
