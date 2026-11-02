import type { QuizQuestion } from "./types";

export type PracticeSummary = {
  answered: number;
  correct: number;
  accuracy: number;
};

export function summarizePractice(
  questions: QuizQuestion[],
  answers: Array<number | null>,
): PracticeSummary {
  let answered = 0;
  let correct = 0;
  for (const [index, question] of questions.entries()) {
    const answer = answers[index];
    if (answer === null || answer === undefined) continue;
    answered += 1;
    if (answer === question.correctIndex) correct += 1;
  }

  return {
    answered,
    correct,
    accuracy: answered === 0 ? 0 : Math.round((correct / answered) * 100),
  };
}
