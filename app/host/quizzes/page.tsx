'use client';

import { useGetQuizzes } from '@/api/quiz/quiz';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function QuizzesPage() {
  const { data, isLoading, isError } = useGetQuizzes();

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Something went wrong</p>;

  const quizzes = data?.data ?? [];

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4">
      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="p-20">
            <h1 className="font-bold text-3xl text-primary">
              No quizzes found
            </h1>
          </CardContent>
        </Card>
      ) : (
        quizzes.map(quiz => (
          <Link
            key={quiz.id}
            href={`/host/quizzes/${quiz.id}`}
            className="w-full max-w-xl"
            style={{ textDecoration: 'none' }}
          >
            <Card className="w-full max-w-xl cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold">{quiz.title}</h2>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
