// ─── gameConstants.js ────────────────────────────────────────────────────────
// Constantes e utilitários compartilhados entre todos os jogos da plataforma.
// Importe apenas o que precisar em cada jogo.

export { supabase } from '@/lib/supabaseClient';

export const COMPETITION_ID_COPA = 7;

// ─── Posições ───────────────────────────────────────────────────────────────

export const POSICAO_LABEL = {
  GOL: 'Goleiro', DEF: 'Zagueiro/Lateral', MEI: 'Meio-campo', ATA: 'Atacante',
};
export const POSICAO_COR = {
  GOL: '#F2C14E', DEF: '#5FA8D3', MEI: '#8AD68A', ATA: '#D7263D',
};
export const ORDEM_POSICAO = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };

export function classificarPosicao(p) {
  return ({ Goalkeeper: 'GOL', Defender: 'DEF', Midfielder: 'MEI', Attacker: 'ATA' })[p] || 'OUTRO';
}

// ─── Seleções da Copa 2026 ───────────────────────────────────────────────────

export const GRUPOS_COPA = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'],
  B: ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['USA', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Tunisia', 'Sweden'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde Islands', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Norway', 'Iraq'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'Uzbekistan', 'Colombia', 'Congo DR'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
};

export const SELECOES_COPA = Object.values(GRUPOS_COPA).flat();

export const TIERS_FIXOS = {
  top: ['Brazil', 'Argentina', 'France', 'Spain', 'Belgium', 'England', 'Netherlands', 'Germany', 'Portugal'],
  medio: ['Mexico', 'South Korea', 'Switzerland', 'Morocco', 'Scotland', 'Türkiye', 'USA', 'Ecuador',
    'Japan', 'Sweden', 'Uruguay', 'Norway', 'Colombia', 'Croatia'],
};

// ─── CSS tokens compartilhados (copie para o <style> de cada jogo) ───────────
export const CSS_VARS = {
  bg:      '#0a0f1a',
  turf1:   '#123524',
  turf2:   '#1d5c3c',
  gold:    '#f2c14e',
  chalk:   '#f4f1ea',
  crimson: '#d7263d',
  ink:     '#070a12',
  linha:   'rgba(244,241,234,0.35)',
};

// ─── Helpers de data / seed ──────────────────────────────────────────────────

/** Hash simples de string → número inteiro positivo */
export function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Gerador de números pseudo-aleatórios determinístico (mulberry32) */
export function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha array com semente determinística */
export function seededShuffle(arr, seed) {
  const rng = seededRng(hashStr(String(seed)));
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Retorna a chave de seed do dia: YYYY-MM-DD */
export function getTodaySeed() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Carrega todos os times das seleções da Copa do banco */
export async function loadCopaTimes() {
  const { data } = await supabase
    .from('teams')
    .select('id, name, badge_url, flag_code')
    .in('name', SELECOES_COPA);
  return data || [];
}

/** Carrega jogadores de um time específico, ordenados por posição → overall */
export async function loadJogadoresDoTime(teamId) {
  const { data } = await supabase
    .from('players')
    .select('id, name, position, overall, photo_url')
    .eq('team_id', teamId)
    .eq('competition_id', COMPETITION_ID_COPA);

  return (data || []).sort((a, b) => {
    const pa = ORDEM_POSICAO[classificarPosicao(a.position)] ?? 9;
    const pb = ORDEM_POSICAO[classificarPosicao(b.position)] ?? 9;
    return pa !== pb ? pa - pb : b.overall - a.overall;
  });
}