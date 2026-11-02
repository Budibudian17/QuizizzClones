import { describe, expect, it } from "vitest";

import { summarizePractice } from "@/game/practice";
import { createQuizFixture } from "./quiz-fixture";

describe("solo practice", () => {
  it("counts correct answers and calculates accuracy from answered questions", () => {
    const questions = createQuizFixture().questions;

    expect(summarizePractice(questions, [0, 3, null])).toEqual({
      answered: 2,
      correct: 1,
      accuracy: 50,
    });
  });

  it("returns zero accuracy when the timer expires before an answer", () => {
    expect(summarizePractice(createQuizFixture().questions, [null, null])).toEqual({
      answered: 0,
      correct: 0,
      accuracy: 0,
    });
  });
});
