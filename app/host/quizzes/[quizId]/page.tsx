import { useGetQuizzesId } from '@/api/quiz/quiz';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
      <Card>
        <CardHeader>
          <CardTitle>Course Structure</CardTitle>
          <CardDescription>
            Provide information about the course structure
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <CourseStructure data={course} />
        </CardContent>
      </Card>
    </div>
  );
}
