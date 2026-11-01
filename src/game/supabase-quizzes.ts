import type { Quiz } from "./types";
import { createClient } from "@/utils/supabase/client";

type QuizRow = {
  id: string;
  title: string;
  description: string;
  questions: Quiz["questions"];
  updated_at: string;
};

function mapQuiz(row: QuizRow): Quiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: row.questions,
    updatedAt: Date.parse(row.updated_at),
  };
}

export async function getHostUser() {
  const { data, error } = await createClient().auth.getUser();
  if (error) throw error;
  return data.user && data.user.is_anonymous !== true ? data.user : null;
}

export async function loadOwnedQuizzes(ownerId: string): Promise<Quiz[]> {
  const client = createClient();
  const { data, error } = await client
    .from("quizzes")
    .select("id, title, description, questions, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data as QuizRow[]).map(mapQuiz);
}

export async function getOwnedQuiz(ownerId: string, quizId: string): Promise<Quiz | null> {
  const { data, error } = await createClient()
    .from("quizzes")
    .select("id, title, description, questions, updated_at")
    .eq("owner_id", ownerId)
    .eq("id", quizId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapQuiz(data as QuizRow) : null;
}

export async function saveOwnedQuiz(ownerId: string, quiz: Quiz): Promise<void> {
  const { error } = await createClient().from("quizzes").upsert(
    {
      id: quiz.id,
      owner_id: ownerId,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function deleteOwnedQuiz(ownerId: string, quizId: string): Promise<void> {
  const { error } = await createClient()
    .from("quizzes")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", quizId);
  if (error) throw error;
}
