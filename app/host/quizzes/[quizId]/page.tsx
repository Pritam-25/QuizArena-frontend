import { useGetQuizzesId } from '@/api/quiz/quiz';
import { useParams } from 'next/navigation';

export default function Page() {
  const params = useParams();
  let quizId = params.quizId;
  if (Array.isArray(quizId)) {
    quizId = quizId[0];
  }
  const { data, isLoading, isError } = useGetQuizzesId(quizId);

  if (isLoading) return <div>Loading...</div>;
  if (isError || !data) return <div>Quiz not found.</div>;

  const quiz = data.data;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">
        Edit Course:
        <span className="text-primary"> {quiz.title}</span>
      </h1>
      Quiz ID: {quizId}
    </div>
  );
}
