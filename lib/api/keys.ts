import { getGetAuthMeQueryKey } from "@/api/auth/auth";
import { getGetQuizzesQueryKey } from "@/api/quiz/quiz";

export const queryKeys = {
  auth: {
    me: () => getGetAuthMeQueryKey(),
  },
  quiz: {
    list: () => getGetQuizzesQueryKey(),
  },
};
