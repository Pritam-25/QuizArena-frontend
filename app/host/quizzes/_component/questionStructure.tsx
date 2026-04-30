import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          Here you can define the structure of your quiz questions. You can add
          different types of questions such as multiple choice, true/false, or
          open-ended questions. Each question can have its own set of options
          and correct answers.
        </p>
      </CardContent>
    </Card>
  );
}
