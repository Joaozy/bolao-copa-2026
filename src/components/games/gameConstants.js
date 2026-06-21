// ─── gameConstants.js ────────────────────────────────────────────────────────

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

// 👇 NOVO CLASSIFICADOR: Lê perfeitamente as suas siglas em português
export function classificarPosicao(pos) {
  if (!pos) return 'OUTRO';
  const p = pos.toUpperCase();
  
  if (['GOL'].includes(p)) return 'GOL';
  if (['ZAG', 'LD', 'LE'].includes(p)) return 'DEF';
  if (['VOL', 'MC', 'ME', 'MD', 'MEI'].includes(p)) return 'MEI';
  if (['SA', 'PD', 'PE', 'CA'].includes(p)) return 'ATA';
  
  return 'OUTRO';
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

// ─── CSS tokens compartilhados ──────────────────────────────────────────────
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

export function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(arr, seed) {
  const rng = seededRng(hashStr(String(seed)));
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getTodaySeed() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Carrega todos os times garantindo que puxa APENAS da Copa, ignorando o Brasileirão */
export async function loadCopaTimes() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, badge_url, flag_code');
    
  if (error) {
    console.error("Erro ao buscar times:", error);
    return [];
  }
  // Peneira final no código para garantir que Bahia, Botafogo, etc., não entrem
  return data.filter(t => SELECOES_COPA.includes(t.name));
}

/** 👇 NOVO CÓDIGO DA BUSCA: Agora busca pos1, pos2, pos3 */
export async function loadJogadoresDoTime(teamId) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, pos1, pos2, pos3, overall, photo_url')
    .eq('team_id', teamId)
    .eq('competition_id', COMPETITION_ID_COPA);

  if (error) {
    console.error("Erro ao buscar jogadores:", error);
    return [];
  }

  return (data || []).sort((a, b) => {
    // Ordena baseando-se na pos1 (Posição principal)
    const pa = ORDEM_POSICAO[classificarPosicao(a.pos1)] ?? 9;
    const pb = ORDEM_POSICAO[classificarPosicao(b.pos1)] ?? 9;
    return pa !== pb ? pa - pb : b.overall - a.overall;
  });
}