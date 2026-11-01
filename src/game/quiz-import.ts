import type { QuizQuestion } from "./types";

export type ImportedQuestion = Omit<QuizQuestion, "id">;

type QuestionBlock = {
  number: number;
  text: string[];
  options: { label: string; text: string }[];
  answer: number | null;
  optionsStarted: boolean;
};

function cleanLine(line: string): string {
  return line.trim().replace(/^>\s*/, "").replace(/\*\*/g, "").replace(/__/g, "");
}

export function parseQuizText(input: string): {
  questions: ImportedQuestion[];
  errors: string[];
} {
  const blocks: QuestionBlock[] = [];
  let current: QuestionBlock | null = null;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const questionMatch = line.match(/^(?:#{1,6}\s*)?(?:soal\s*)?(\d+)\s*[-.):]\s*(.*)$/i);
    if (questionMatch) {
      if (current) blocks.push(current);
      current = {
        number: Number(questionMatch[1]),
        text: questionMatch[2] ? [questionMatch[2].trim()] : [],
        options: [],
        answer: null,
        optionsStarted: false,
      };
      continue;
    }

    if (!current) continue;

    const optionLine = line.replace(/^[-*•]\s*/, "").match(/^([A-D])\s*[-.):]\s*(.+)$/i);
    if (optionLine) {
      current.optionsStarted = true;
      current.options.push({
        label: optionLine[1]!.toUpperCase(),
        text: optionLine[2]!.trim(),
      });
      continue;
    }

    const answerMatch = line.match(
      /^(?:kunci(?:\s+jawaban)?|jawaban(?:\s+benar)?|answer(?:\s+key)?|correct\s+answer)\s*[:-]\s*([A-D])\b/i,
    );
    if (answerMatch) {
      current.answer = answerMatch[1]!.toUpperCase().charCodeAt(0) - 65;
      continue;
    }

    if (!current.optionsStarted) current.text.push(line);
  }

  if (current) blocks.push(current);

  const errors: string[] = [];
  const questions: ImportedQuestion[] = [];
  if (blocks.length === 0) {
    return {
      questions,
      errors: [
        "Format soal belum dikenali. Awali setiap soal dengan nomor, misalnya “1. Pertanyaan”.",
      ],
    };
  }

  for (const block of blocks) {
    const label = `Soal ${block.number}`;
    const text = block.text.join(" ").trim();
    if (!text) errors.push(`${label}: teks pertanyaan kosong.`);
    const optionLabels = block.options.map((option) => option.label);
    const optionsValid =
      optionLabels.length === 4 &&
      ["A", "B", "C", "D"].every(
        (letter) => optionLabels.filter((label) => label === letter).length === 1,
      );
    if (!optionsValid) {
      errors.push(`${label}: harus memiliki pilihan A, B, C, dan D masing-masing satu kali.`);
    }
    if (block.answer === null) errors.push(`${label}: kunci jawaban belum ditemukan.`);
    if (!text || !optionsValid || block.answer === null) continue;

    questions.push({
      text,
      options: ["A", "B", "C", "D"].map(
        (letter) => block.options.find((option) => option.label === letter)!.text,
      ),
      correctIndex: block.answer,
      timerSec: 20,
    });
  }

  return { questions, errors };
}
