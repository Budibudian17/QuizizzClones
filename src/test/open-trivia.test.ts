import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTriviaQuiz,
  mapOpenTriviaQuestion,
  translateTriviaQuizToIndonesian,
} from "@/game/open-trivia";
import type { Quiz } from "@/game/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Open Trivia DB questions", () => {
  it("decodes API text and keeps the answer key aligned after shuffling", () => {
    const question = mapOpenTriviaQuestion({
      type: "multiple",
      category: "Science%3A%20Computers",
      question: "What%20does%20HTML%20stand%20for%3F",
      correct_answer: "HyperText%20Markup%20Language",
      incorrect_answers: [
        "HyperText%20Markdown%20Language",
        "Home%20Tool%20Markup%20Language",
        "Hyperlink%20Text%20Management%20Language",
      ],
    });

    expect(question.text).toBe("What does HTML stand for?");
    expect(question.options).toHaveLength(4);
    expect(question.options[question.correctIndex]).toBe("HyperText Markup Language");
    expect(question.source).toBe("opentdb");
  });

  it("rejects malformed or non-multiple-choice questions", () => {
    expect(() => mapOpenTriviaQuestion({})).toThrow("format tidak valid");
    expect(() =>
      mapOpenTriviaQuestion({
        type: "boolean",
        category: "General Knowledge",
        question: "True or false?",
        correct_answer: "True",
        incorrect_answers: ["False"],
      }),
    ).toThrow("bukan pilihan ganda empat opsi");
  });

  it("translates question text and options without changing the answer key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          responseStatus: 200,
          quotaFinished: false,
          responseData: { translatedText: "Teks bahasa Indonesia" },
        }),
      })),
    );
    const quiz: Quiz = {
      id: "quiz_api",
      title: "English quiz title",
      description: "",
      updatedAt: 1,
      questions: [
        {
          id: "q_api",
          text: "Unique English question",
          options: [
            "Unique wrong one",
            "Unique right two",
            "Unique wrong three",
            "Unique wrong four",
          ],
          correctIndex: 1,
          timerSec: 20,
          source: "opentdb",
        },
      ],
    };

    const translated = await translateTriviaQuizToIndonesian(quiz);

    expect(translated.translationStatus).toBe("complete");
    expect(translated.title).toBe("Teks bahasa Indonesia");
    expect(translated.questions[0]?.correctIndex).toBe(1);
    expect(translated.questions[0]?.options).toEqual(Array(4).fill("Teks bahasa Indonesia"));
  });

  it("falls back to source text when the translation service is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({}),
      })),
    );
    const quiz: Quiz = {
      id: "quiz_fallback",
      title: "Unique fallback title",
      description: "",
      updatedAt: 1,
      questions: [
        {
          id: "q_fallback",
          text: "Unique fallback question",
          options: [
            "Unique fallback A",
            "Unique fallback B",
            "Unique fallback C",
            "Unique fallback D",
          ],
          correctIndex: 0,
          timerSec: 20,
          source: "opentdb",
        },
      ],
    };

    const result = await translateTriviaQuizToIndonesian(quiz);

    expect(result.translationStatus).toBe("partial");
    expect(result.title).toBe(quiz.title);
    expect(result.questions[0]?.text).toBe(quiz.questions[0]?.text);
  });

  it("does not call the translation service when English is selected", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response_code: 0,
        results: [
          {
            type: "multiple",
            category: "General Knowledge",
            question: "What%20is%20two%20plus%20two%3F",
            correct_answer: "Four",
            incorrect_answers: ["One", "Two", "Three"],
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const quiz = await fetchTriviaQuiz({ amount: 1, language: "en" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(quiz.translationStatus).toBeUndefined();
    expect(quiz.questions[0]?.text).toBe("What is two plus two?");
  });
});
