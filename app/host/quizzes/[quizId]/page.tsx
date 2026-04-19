export default async function Page({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;

  return (
    <div className="flex w-full h-screen items-center justify-center font-bold text-2xl">
      Quiz ID: {quizId}
      
    </div>
  );
}
