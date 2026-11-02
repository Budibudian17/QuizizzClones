import { makeId, type Quiz, type QuizQuestion } from "./types";

const API_BASE = "https://opentdb.com";
const TRANSLATION_API = "https://api.mymemory.translated.net/get";
const MIN_QUESTION_REQUEST_INTERVAL_MS = 5000;
const MAX_TRANSLATION_BYTES = 500;

export type TriviaCategory = {
  id: number;
  name: string;
};

export type TriviaDifficulty = "easy" | "medium" | "hard";
export type TriviaLanguage = "id" | "en";

type ApiQuestion = {
  type: string;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
};

let categoriesCache: TriviaCategory[] | null = null;
let categoriesRequest: Promise<TriviaCategory[]> | null = null;
let lastQuestionRequestAt = 0;
let translationQuotaFinished = false;
const translationCache = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeApiText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function apiError(responseCode: number): Error {
  if (responseCode === 1) {
    return new Error("API tidak memiliki cukup soal untuk pilihan ini. Coba kategori lain.");
  }
  if (responseCode === 2) {
    return new Error("Pilihan kategori atau jumlah soal tidak valid.");
  }
  if (responseCode === 5) {
    return new Error("Open Trivia DB membatasi permintaan. Tunggu 5 detik sebelum mencoba lagi.");
  }
  return new Error(`Open Trivia DB mengembalikan kode respons ${responseCode}.`);
}

export async function loadTriviaCategories(): Promise<TriviaCategory[]> {
  if (categoriesCache) return categoriesCache;
  if (categoriesRequest) return categoriesRequest;

  categoriesRequest = (async () => {
    const response = await fetch(`${API_BASE}/api_category.php`);
    if (!response.ok) throw new Error(`Gagal memuat kategori soal (HTTP ${response.status}).`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload["trivia_categories"])) {
      throw new Error("Open Trivia DB mengirim daftar kategori dengan format tidak valid.");
    }

    const categories = payload["trivia_categories"].flatMap((item): TriviaCategory[] => {
      if (!isRecord(item) || typeof item["id"] !== "number" || typeof item["name"] !== "string") {
        return [];
      }
      return [{ id: item["id"], name: item["name"] }];
    });
    if (categories.length === 0) throw new Error("Open Trivia DB belum menyediakan kategori soal.");
    categoriesCache = categories;
    return categories;
  })();

  try {
    return await categoriesRequest;
  } finally {
    categoriesRequest = null;
  }
}

export function mapOpenTriviaQuestion(value: unknown): QuizQuestion {
  if (
    !isRecord(value) ||
    typeof value["type"] !== "string" ||
    typeof value["category"] !== "string" ||
    typeof value["question"] !== "string" ||
    typeof value["correct_answer"] !== "string" ||
    !Array.isArray(value["incorrect_answers"]) ||
    !value["incorrect_answers"].every((answer) => typeof answer === "string")
  ) {
    throw new Error("Open Trivia DB mengirim soal dengan format tidak valid.");
  }
  const item = value as ApiQuestion;
  if (item.type !== "multiple" || item.incorrect_answers.length !== 3) {
    throw new Error("Open Trivia DB mengirim soal yang bukan pilihan ganda empat opsi.");
  }
  const correctAnswer = decodeApiText(item.correct_answer);
  const options = [...item.incorrect_answers.map(decodeApiText), correctAnswer];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex]!, options[index]!];
  }

  return {
    id: makeId("q"),
    text: decodeApiText(item.question),
    options,
    correctIndex: options.indexOf(correctAnswer),
    timerSec: 20,
    source: "opentdb",
  };
}

async function translateToIndonesian(text: string): Promise<string | null> {
  const cached = translationCache.get(text);
  if (cached) return cached;
  if (translationQuotaFinished || new TextEncoder().encode(text).length > MAX_TRANSLATION_BYTES) {
    return null;
  }

  const params = new URLSearchParams({ q: text, langpair: "en|id" });
  try {
    const response = await fetch(`${TRANSLATION_API}?${params.toString()}`);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return null;
    if (payload["quotaFinished"] === true) {
      translationQuotaFinished = true;
      return null;
    }

    const responseData = payload["responseData"];
    if (
      !isRecord(responseData) ||
      typeof responseData["translatedText"] !== "string" ||
      payload["responseStatus"] !== 200
    ) {
      return null;
    }
    const translated = responseData["translatedText"].trim();
    if (!translated) return null;
    translationCache.set(text, translated);
    return translated;
  } catch {
    return null;
  }
}

export async function translateTriviaQuizToIndonesian(quiz: Quiz): Promise<Quiz> {
  const entries = [
    quiz.title,
    ...quiz.questions.flatMap((question) => [question.text, ...question.options]),
  ];
  const translations: Array<string | null> = Array.from({ length: entries.length }, () => null);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(3, entries.length) }, async () => {
    while (nextIndex < entries.length && !translationQuotaFinished) {
      const index = nextIndex++;
      translations[index] = await translateToIndonesian(entries[index]!);
    }
  });
  await Promise.all(workers);

  let translatedIndex = 1;
  const questions = quiz.questions.map((question) => {
    const text = translations[translatedIndex++] ?? question.text;
    const options = question.options.map((option) => translations[translatedIndex++] ?? option);
    return { ...question, text, options };
  });

  return {
    ...quiz,
    title: translations[0] ?? quiz.title,
    questions,
    translationStatus: translations.every((translation) => translation !== null)
      ? "complete"
      : "partial",
  };
}

export async function fetchTriviaQuiz(options: {
  amount: number;
  categoryId?: number;
  difficulty?: TriviaDifficulty;
  language?: TriviaLanguage;
}): Promise<Quiz> {
  if (!Number.isInteger(options.amount) || options.amount < 1 || options.amount > 50) {
    throw new Error("Jumlah soal harus antara 1 sampai 50.");
  }

  const now = Date.now();
  const elapsed = now - lastQuestionRequestAt;
  if (lastQuestionRequestAt > 0 && elapsed < MIN_QUESTION_REQUEST_INTERVAL_MS) {
    throw new Error("Tunggu 5 detik sebelum meminta soal baru dari Open Trivia DB.");
  }

  const params = new URLSearchParams({
    amount: String(options.amount),
    type: "multiple",
    encode: "url3986",
  });
  if (options.categoryId !== undefined) params.set("category", String(options.categoryId));
  if (options.difficulty) params.set("difficulty", options.difficulty);

  lastQuestionRequestAt = now;
  const response = await fetch(`${API_BASE}/api.php?${params.toString()}`);
  if (!response.ok) throw new Error(`Gagal mengambil soal (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload["response_code"] !== "number") {
    throw new Error("Open Trivia DB mengirim respons soal dengan format tidak valid.");
  }
  if (payload["response_code"] !== 0) throw apiError(payload["response_code"]);
  if (!Array.isArray(payload["results"]) || payload["results"].length === 0) {
    throw new Error("Open Trivia DB tidak mengembalikan soal untuk pilihan ini.");
  }

  const results = payload["results"];
  const questions = results.map(mapOpenTriviaQuestion);
  const firstResult = results[0];
  if (!isRecord(firstResult) || typeof firstResult["category"] !== "string") {
    throw new Error("Open Trivia DB mengirim kategori soal dengan format tidak valid.");
  }
  const category = decodeApiText(firstResult["category"]);

  const quiz: Quiz = {
    id: makeId("quiz"),
    title: `Latihan ${category}`,
    description:
      "Soal dari Open Trivia Database dengan lisensi CC BY-SA 4.0. Diterjemahkan otomatis oleh MyMemory.",
    questions,
    updatedAt: Date.now(),
  };
  return options.language === "en" ? quiz : translateTriviaQuizToIndonesian(quiz);
}
