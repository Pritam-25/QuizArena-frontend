import { Card, CardContent } from '@/components/ui/card';

export default function Page() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <Card>
        <CardContent className="p-20">
          <h1 className="font-bold text-3xl text-primary">
            Welcome to QuizArena
          </h1>
        </CardContent>
      </Card>
    </div>
  );
}
