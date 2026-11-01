import type { Quiz } from "@/game/types";

export function createQuizFixture(): Quiz {
  return {
    id: "quiz_test",
    title: "Test Quiz",
    description: "Quiz fixture for game rule tests.",
    questions: [
      {
        id: "question_1",
        text: "Which option is correct?",
        options: ["Correct", "Option B", "Option C", "Option D"],
        correctIndex: 0,
        timerSec: 10,
      },
      {
        id: "question_2",
        text: "Which option is correct?",
        options: ["Option A", "Correct", "Option C", "Option D"],
        correctIndex: 1,
        timerSec: 20,
      },
    ],
    updatedAt: 0,
  };
}
