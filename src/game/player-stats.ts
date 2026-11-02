import { createPlayerClient } from "@/utils/supabase/client";

export type PlayerGameResult = {
  room_id: string;
  nickname: string;
  quiz_title: string;
  pin: string;
  final_rank: number;
  final_score: number;
  correct_answers: number;
  total_questions: number;
  played_at: string;
};

export type PlayerSoloResult = {
  id: string;
  quiz_title: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  played_at: string;
};

export async function getPlayerGameResults(): Promise<PlayerGameResult[]> {
  const client = createPlayerClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user || user.is_anonymous === true) {
    throw new Error("Masuk dengan akun pemain untuk melihat statistik.");
  }

  const { data, error } = await client
    .from("player_game_results")
    .select(
      "room_id, nickname, quiz_title, pin, final_rank, final_score, correct_answers, total_questions, played_at",
    )
    .eq("user_id", user.id)
    .order("played_at", { ascending: false });
  if (error) throw error;
  return data as PlayerGameResult[];
}

export async function getPlayerSoloResults(): Promise<PlayerSoloResult[]> {
  const client = createPlayerClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user || user.is_anonymous === true) {
    throw new Error("Masuk dengan akun pemain untuk melihat statistik.");
  }

  const { data, error } = await client
    .from("player_solo_results")
    .select("id, quiz_title, total_questions, answered_questions, correct_answers, played_at")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false });
  if (error) throw error;
  return data as PlayerSoloResult[];
}

export async function recordPlayerSoloResult(result: {
  resultId: string;
  quizTitle: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
}): Promise<void> {
  const { data, error: sessionError } = await createPlayerClient().auth.getSession();
  if (sessionError) throw sessionError;
  const user = data.session?.user;
  if (!user || user.is_anonymous === true) {
    throw new Error("Masuk dengan akun pemain untuk menyimpan statistik latihan solo.");
  }

  const { error } = await createPlayerClient().rpc("record_player_solo_result", {
    p_result_id: result.resultId,
    p_quiz_title: result.quizTitle,
    p_total_questions: result.totalQuestions,
    p_answered_questions: result.answeredQuestions,
    p_correct_answers: result.correctAnswers,
  });
  if (error) throw error;
}
