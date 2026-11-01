import { describe, expect, it } from "vitest";

import { parseQuizText } from "@/game/quiz-import";

describe("parseQuizText", () => {
  it("parses numbered questions, four options, and Indonesian answer keys", () => {
    const result = parseQuizText(`1. Ibu kota Indonesia?
A. Bandung
B. Jakarta
C. Surabaya
D. Medan
Jawaban: B

2) 2 + 2 = ?
A) 3
B) 4
C) 5
D) 6
Kunci jawaban: B`);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({
      text: "Ibu kota Indonesia?",
      options: ["Bandung", "Jakarta", "Surabaya", "Medan"],
      correctIndex: 1,
      timerSec: 20,
    });
    expect(result.questions[1]?.text).toBe("2 + 2 = ?");
  });

  it("accepts markdown formatting, quote lines, and English answer labels", () => {
    const result = parseQuizText(`> **1. Pertanyaan pertama**
> - **A.** Pilihan pertama
> - **B.** Pilihan kedua
> - **C.** Pilihan ketiga
> - **D.** Pilihan keempat
> Answer: C`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0]).toMatchObject({
      text: "Pertanyaan pertama",
      options: ["Pilihan pertama", "Pilihan kedua", "Pilihan ketiga", "Pilihan keempat"],
      correctIndex: 2,
    });
  });

  it("reports incomplete questions without silently importing them", () => {
    const result = parseQuizText(`1. Pertanyaan tanpa kunci
A. Pilihan satu
B. Pilihan dua
Jawaban: A`);

    expect(result.questions).toEqual([]);
    expect(result.errors).toEqual([
      "Soal 1: harus memiliki pilihan A, B, C, dan D masing-masing satu kali.",
    ]);
  });

  it("maps options by their letter even when pasted out of order", () => {
    const result = parseQuizText(`1. Pertanyaan
D. Pilihan D
B. Pilihan B
A. Pilihan A
C. Pilihan C
Jawaban: C`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0]?.options).toEqual([
      "Pilihan A",
      "Pilihan B",
      "Pilihan C",
      "Pilihan D",
    ]);
    expect(result.questions[0]?.correctIndex).toBe(2);
  });

  it("explains when pasted text contains no numbered questions", () => {
    const result = parseQuizText("Tolong buatkan soal pilihan ganda.");

    expect(result.questions).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
