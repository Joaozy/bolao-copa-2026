import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { userId, gameId, scoreA, scoreB, overrideTime } = await request.json();

    // Conexão com privilégios de Admin para ignorar bloqueios comuns de leitura
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Chama a função que criamos no banco de dados
    const { error } = await supabase.rpc('admin_force_bet', {
      p_user_id: userId,
      p_game_id: gameId,
      p_score_a: scoreA,
      p_score_b: scoreB,
      p_override_time: overrideTime
    });

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true, message: 'Palpite injetado com sucesso!' }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}