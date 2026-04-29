'use client';
import { useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGetQuizzesAdminId } from '@/api/quiz/quiz';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionEditor } from '@/features/quiz/components/QuestionEditor';
import { useQuizDraftStore } from '@/features/quiz/store/useQuizDraftStore';
import { mapQuizToDraft } from '@/features/quiz/mappers/quizMapper';
import { useAutosaveQueueInit } from '@/features/quiz/hooks/useAutosaveQueueInit';
import { useQueueWorker } from '@/features/quiz/hooks/useQueueWorker';

export default function Page() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;
  const initializedRef = useRef(false);

  // Initialize autosave queue system
  useAutosaveQueueInit();
  useQueueWorker();

  const { data, isLoading, isError } = useGetQuizzesAdminId(quizId);
  const setQuiz = useQuizDraftStore(state => state.setQuiz);
  const questionIds = useQuizDraftStore(
    useShallow(state => Object.keys(state.questions))
  );
  const addQuestionLocal = useQuizDraftStore(state => state.addQuestion);

  // Initialize store with quiz data
  useEffect(() => {
    if (data?.data && !initializedRef.current) {
      const mapped = mapQuizToDraft(data.data);
      setQuiz(mapped);
      initializedRef.current = true;
    }
  }, [data, setQuiz]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Quiz not found.</p>
      </div>
    );
  }

  const quiz = data.data;

  /**
   * Handle adding a new question (LOCAL ONLY - no backend call)
   * Backend save happens via autosave when user edits the question
   */
  const handleAddQuestion = () => {
    const tempId = `temp_${crypto.randomUUID()}`;
    addQuestionLocal(tempId);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          {quiz.description && (
            <p className="text-sm text-muted-foreground">{quiz.description}</p>
          )}
        </div>
        <Button onClick={handleAddQuestion}>Add Question</Button>
      </div>

      <div className="space-y-6">
        {questionIds.map(questionId => (
          <QuestionEditor
            key={questionId}
            quizId={quizId}
            questionId={questionId}
          />
        ))}

        {questionIds.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No questions yet. Click &quot;Add Question&quot; to create your
                first question.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
