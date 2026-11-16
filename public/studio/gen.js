/*!
 * EvilVerse Studio — генератор промо-роликов для медиа.
 * © 2026 EvilVerse (evilverse.lol). Все права защищены. All rights reserved.
 * Идея, концепция и реализация принадлежат EvilVerse. Дата фиксации: 16.11.2026.
 * Проприетарное ПО: копирование, изменение, распространение и использование
 * вне evilverse.lol без письменного разрешения запрещены. См. LICENSE.txt.
 */
// Генератор роликов EvilVerse: сценарий из банка фраз → таймлайн → кадры (поверх движка renderer.js) → звук (голос + бит + мем-звуки)
// Использует глобальные функции движка: g, W, H, bg, header, SC, card, signAt, rr, back, ease, clamp, lerp, NETH
window.GEN = (() => {
  const ALL = window.GEN_BANK; let BANK = ALL.filter((x) => x.tts !== false);
  const usePool = (set) => { BANK = ALL.filter((x) => set.delivery === 'text' || x.tts !== false); };
  const VFX_RATE = {normal:1, demon:.84, radio:1, echo:1, chip:1.3};
  const vrate = (set) => TEMPO[set.tempo].rate * (set.voiceRate || 1) * (VFX_RATE[set.vfx] || 1);
  const lineDur = (L, set) => (set.delivery === 'text' || L.tts === false) ? L.dur * ({1:1.15, 2:1, 3:.8}[set.tempo]) : L.dur / vrate(set);
  const byId = Object.fromEntries(ALL.map((x) => [x.id, x]));

  // ---------- случайность с зерном ----------
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const shuffle = (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const THEMES = {wipe:'Вайп', server:'Сервер', meme:'Мемы', hard:'Хардкор', clan:'Кланы', dare:'Вызов', mix:'Микс'};
  const TRANS = {simple:['fade','slide','cut','fade'], cool:['whip','zoom','glitch','spin','slide'], crazy:['flip','burn','pixel','shatter','whip','glitch','zoom','spin']};
  const STICKERS = ['ГГ','F','ЛЕГЕНДА','ПОЗОР','ЖИЗА','ЭТО Я','НЕ Я','ОЙ','БАЗА','КРИНЖ','ИМБА','ХАРДКОР','СТРАШНО','ВАУ','100%','ЛОЛ','ЖЕСТЬ','РИСК','ОПАСНО','МОЩЬ','НЕ ПОВТОРЯТЬ','СКИЛЛ','ВЕЗЕНИЕ','ПОЧТИ','ЛУЧШИЙ','ГЕНИЙ','ШОК','ДА ЛАДНО','ВЫЖИЛ','RIP','ОГОНЬ','ИЗИ','ТЯЖКО','КОМБО','ЧТО?!','ЭПИК','ДРАМА','СЮЖЕТ','ПЛАН','БЕГИ'];
  const TEMPO = {
    1: {gap:.42, rate:1.0, bpm:92, chunk:0, trans:['fade','slide','zoom'], punch:0},
    2: {gap:.14, rate:1.05, bpm:128, chunk:2, trans:['whip','zoom','slide','glitch'], punch:.5},
    3: {gap:.02, rate:1.13, bpm:150, chunk:1, trans:['whip','glitch','cut','spin','zoom'], punch:1},
  };
  const fits = (x, th) => th === 'mix' || x.th.includes(th) || x.th.includes('any');

  // ---------- форматы роликов (шаблоны по мотивам вирусных роликов серверов) ----------
  const IPS = ['c_ip','c_ip2','x_z1','x_z2','c_dare'];
  const F = (name, seq, o = {}) => ({name, seq, ...o});
  const P = (pool, o = {}) => ({pool, ...o});
  const FORMATS = {
    classic: F('Классика: хук → факты → призыв', null),
    dont:    F('«Не играй здесь, если…»', [['h_n1','x_d1'], P(['x_d1','x_d2','x_d3','x_d4','b_n15'])], {cta:['x_d5']}),
    tier:    F('Тир-лист механик', ['h_n6', P(['b_n1','b_n2','b_n3','x_t1','x_t2','x_t3','x_t4','x_t5'])], {cta:['x_t6']}),
    types:   F('Типы игроков', ['h_n4', P(['b_n7','b_n8','b_n9','b_n10','x_y1','x_y2','x_y3','x_y4'], {order:'seq'})], {cta:['x_y5']}),
    flags:   F('Зелёные и красные флаги', ['h_n5', P(['b_n4','b_n5','x_f1','x_f2','b_n6','x_f3','x_f4'])]),
    quiz:    F('Викторина «Угадай»', [[['h_n7','b_n11'],['x_q1','x_q2'],['x_q3','x_q4']], P(['b_xp','b_heart','b_roar','b_death','x_m2'], {max:2})], {cta:['x_q5']}),
    reply:   F('Ответ на комментарий', ['h_n3', P(['b_roar','b_xpm','b_border','b_alt','b_air','b_bounty','x_c1','x_n2'])], {cta:['x_z3']}),
    top5:    F('Топ-5 причин зайти', ['x_o0','x_o5','x_o4','x_o3','x_o2','x_o1'], {fixed:true}),
    pov:     F('POV', [['x_p1','x_p2','x_p3','x_p4','x_p5','m_noob'], P(['b_air','b_alt','b_roar','b_bounty','b_death','b_heart','x_m1'], {max:3})]),
    story:   F('История одной смерти', ['x_s1','x_s2','x_s3','x_s4','x_s5','x_s6'], {fixed:true, cta:['c_dare','x_z1']}),
    vs:      F('Обычный сервер vs EvilVerse', [['h_s2','b_vs'], P(['b_vs','x_v1','x_v2','x_v3','x_v4'])]),
    week:    F('Неделя прайм-тайма', ['x_w0','x_w1','x_w2','x_w3','x_w4'], {fixed:true}),
    altars:  F('Клановые войны за 30 секунд', ['x_a1', P(['x_a2','x_a3','x_a4','x_a5','b_heart','x_a6','x_a7','b_merc'], {order:'seq'})], {cta:['c_tag','x_z2']}),
    newbie:  F('Гайд новичку', ['x_g0', P(['x_g1','x_g2','x_g3','x_g4','x_e1','b_daily'], {order:'seq'})], {cta:['x_z1']}),
    daytime: F('Что творится днём', [['x_p1','h_s2'], P(['x_m1','x_m2','x_m3','b_air','b_quiz'])]),
    economy: F('Опыт = деньги', ['h_s1', P(['b_xpm','x_e1','x_e2','x_e3','b_xp','m_iq','x_k5'])]),
    fun:     F('Кейсы, эмоции, мини-игры', ['h_s2', P(['x_c1','x_c2','x_c3','x_n1','x_n2','x_t5'])]),
    votes:   F('Голосуй и получай', ['h_m1', P(['x_r1','x_r2','b_daily','x_g2'])]),
    bounty:  F('Охота за головами', ['x_p4', P(['b_bounty','x_n3','x_f4','b_n8','b_roar'])]),
    trailer: F('Трейлер вайпа', ['x_h1','b_death','b_roar','x_h3','x_h4','x_h2'], {fixed:true, cta:['x_z1']}),
    wipe:    F('Вайп 04.12', [['h_w1','h_w2','h_w3','h_n8','x_p5'], P(['b_wipe','b_race','b_time','b_n13','b_n14','x_h3','x_h4','x_h2'])], {cta:['c_n1','c_wipe']}),
    memes:   F('Мем-нарезка', [['h_m1','h_m3','h_m4','h_m5','h_n4'], P(['m_cat','m_sigma','m_cringe','m_fool','m_plan','m_wasted','m_legend','m_noob','m_dialog','m_sleep','m_n1','m_n2','m_n5','m_n6','x_k1','x_k2','x_k3','x_k4','x_k5','x_k7','x_k8'])], {cta:['c_tag','c_n2']}),
    chats:   F('Переписки', [['h_m2','m_n6'], P(['m_mom','m_teacher','m_grandma','m_n3','m_n4','x_k6'])], {cta:['c_tag']}),
    dare:    F('Вызов зрителю', [['h_x1','h_x2','h_n9','h_h2'], P(['b_death','b_roar','b_border','b_n15','b_n12','x_d1','b_vs','x_s4'])], {cta:['c_dare','c_ask']}),
    hard:    F('Хардкор-правила', [['h_h1','h_n2','h_h3'], P(['b_death','b_chat','b_roar','b_xp','x_g4','b_shield','m_sigma'])], {cta:['c_dare']}),
    clan:    F('Набор в клан', [['h_c1','h_c2'], P(['b_alt','b_clan','b_friends','b_merc','x_v4','b_heart','x_y1'])], {cta:['c_tag','x_z2']}),
  };
  const FORMAT_FOR_THEME = {wipe:['wipe','trailer','top5','classic'], server:['tier','vs','reply','economy','daytime','fun','week','newbie','classic'], meme:['memes','chats','types','flags','classic'],
    hard:['hard','story','dont','quiz','classic'], clan:['clan','altars','week','classic'], dare:['dare','dont','quiz','story','classic'], mix:Object.keys(FORMATS)};

  function fromFormat(fk, set, r) {
    const fm = FORMATS[fk], tp = TEMPO[set.tempo], len = (id) => lineDur(byId[id], set) + tp.gap, used = new Set(), out = [];
    const push = (id) => { if (id && byId[id] && !used.has(id)) { used.add(id); out.push(id); } };
    const ctaIds = (fm.cta || []).slice(); const ip = pick(r, IPS.filter((x) => !used.has(x)));
    const tail = (fm.cta && set.length >= 16 ? [pick(r, fm.cta)] : []).concat(fm.noIp ? [] : [ip]);
    const tailLen = tail.reduce((a, x) => a + len(x), 0);
    const total = () => out.reduce((a, x) => a + len(x), 0) + tailLen;
    for (const step of fm.seq) {
      if (typeof step === 'string') push(step);
      else if (Array.isArray(step)) { const c = pick(r, step); (Array.isArray(c) ? c : [c]).forEach(push); }
      else if (step.pool) { let pool = step.order === 'seq' ? step.pool.slice() : shuffle(r, step.pool); let k = 0;
        for (const id of pool) { if (used.has(id)) continue; if (total() + len(id) > set.length + 2 && k >= 1) break; if (step.max && k >= step.max) break; push(id); k++;
          if (set.humor > 0 && !fm.fixed && fk !== 'memes' && r() < (set.humor === 2 ? .35 : .15)) { const m = pick(r, BANK.filter((x) => x.role === 'meme' && !used.has(x.id))); if (m && total() + len(m.id) <= set.length + 1) push(m.id); } } }
    }
    if (!fm.fixed) { const extra = shuffle(r, BANK.filter((x) => x.role === 'body' && !used.has(x.id) && fits(x, set.theme === 'mix' ? 'server' : set.theme))); let g = 0;
      while (total() < set.length - 2.5 && g < extra.length) { const x = extra[g++]; if (total() + len(x.id) <= set.length + 2) push(x.id); } }
    tail.forEach(push);
    return out;
  }

  // ---------- сценарий ----------
  function makeScript(set, seed) {
    usePool(set); const r = rng(seed), th = set.theme;
    let fk = set.format || 'classic';
    if (fk === 'auto') fk = pick(r, FORMAT_FOR_THEME[th] || ['classic']);
    if (fk !== 'classic' && FORMATS[fk]) { const ids = fromFormat(fk, set, r); ids.format = fk; return ids; }
    const humor = th === 'meme' ? Math.max(1, set.humor) : set.humor;
    const tp = TEMPO[set.tempo];
    const used = new Set();
    const take = (pool) => { const p = pool.filter((x) => !used.has(x.id)); if (!p.length) return null; const x = pick(r, p); used.add(x.id); return x; };
    const hooks = BANK.filter((x) => x.role === 'hook' && fits(x, th) && (humor > 0 || !x.th.every((t) => t === 'meme')));
    const body = BANK.filter((x) => x.role === 'body' && fits(x, th));
    const memes = BANK.filter((x) => x.role === 'meme' && (th === 'mix' || th === 'meme' || x.th.includes(th) || x.th.includes('any')));
    const allBody = BANK.filter((x) => x.role === 'body');
    const ctaIp = BANK.filter((x) => x.role === 'cta' && x.scene === 'ip' && (x.id !== 'c_wipe' || th === 'wipe' || th === 'mix'));
    const ctaAsk = BANK.filter((x) => x.role === 'cta' && x.scene !== 'ip');
    const len = (x) => lineDur(x, set) + tp.gap;

    const out = [];
    out.push(take(hooks.length ? hooks : BANK.filter((x) => x.role === 'hook')));
    const end = [];
    if (humor > 0 && set.length >= 20 && r() < .6) end.push(take(ctaAsk));
    end.push(take(th === 'wipe' && r() < .6 ? [byId.c_wipe] : ctaIp));
    const endLen = end.reduce((s, x) => s + len(x), 0);
    const memeShare = humor === 0 ? 0 : (th === 'meme' ? (humor === 1 ? .5 : .8) : (humor === 1 ? .3 : .6));
    let total = len(out[0]) + endLen, guard = 0;
    while (total < set.length - .5 && guard++ < 40) {
      const wantMeme = r() < memeShare && memes.some((x) => !used.has(x.id));
      let x = wantMeme ? take(memes) : take(body);
      if (!x) x = take(memes) || take(allBody);
      if (!x) break;
      if (total + len(x) > set.length + 3 && out.length > 1) { used.delete(x.id); if (guard > 30) break; continue; }
      out.push(x); total += len(x);
    }
    return out.concat(end).filter(Boolean).map((x) => x.id);
  }

  // заменить одну строку сценария на другую того же типа
  function reroll(ids, idx, set, seed) {
    usePool(set); const r = rng(seed), cur = byId[ids[idx]];
    const role = cur.role === 'meme' || cur.role === 'body' ? ['body','meme'] : [cur.role];
    const pool = BANK.filter((x) => role.includes(x.role) && !ids.includes(x.id) && (cur.role !== 'cta' || (cur.scene === 'ip') === (x.scene === 'ip')) && (fits(x, set.theme) || cur.role === 'meme'));
    if (!pool.length) return ids;
    const n = ids.slice(); n[idx] = pick(r, pool).id; return n;
  }

  // ---------- таймлайн ----------
  const clean = (s) => s.replace(/[«»"]/g, '').replace(/\s+—\s+/g, ' ').trim();
  function build(ids, set, seed) {
    const r = rng(seed ^ 0x9e3779b9), tp = TEMPO[set.tempo];
    let t = .25; const items = [], chunks = [], sfx = [], fx = [];
    let flashes = 0;
    ids.forEach((id, k) => {
      const L = byId[id], vd = lineDur(L, set), voiced = set.delivery !== 'text' && L.tts !== false && set.voice !== false;
      const it = {id, scene:L.scene, p:L.p || {}, caps:L.caps, fx:L.fx, st:L.st, start:t, voiceAt:t, vd, voiced, end:t + vd + tp.gap,
        trans: k === 0 ? 'cut' : pick(r, TRANS[set.trans] || tp.trans), tilt:(r() - .5) * .06};
      items.push(it);
      if (k > 0 && it.trans !== 'cut' && set.tempo > 1) sfx.push({t:t - .1, type:'whoosh'});
      if (L.fx) { fx.push({t:t + .05, type:L.fx}); sfx.push({t:t + .05, type:L.fx}); }
      const stx = L.st || (set.humor > 0 && L.role !== 'cta' && r() < (set.humor === 2 ? .45 : .2) ? pick(r, STICKERS) : null);
      if (stx && set.humor > 0) { const ts = t + Math.min(vd * .55, vd - .4); fx.push({t:ts, type:'sticker', text:stx, rot:(r() - .5) * .5, x:.25 + r() * .5}); sfx.push({t:ts, type:'pop'}); }
      const SC_SFX = {num:'ding', meter:'rise', rate:'win', tier:'ding', rank:'ding', case:'levelup', xp:'coin', xpmoney:'coin', bounty:'coin', border:'siren', chat:'bell', shield:'shield', airdrop:'thud', altars:'horn', roar:'roar', warn:'alarm', mic:'radio', day:'whoosh', guide:'tick', dialog:'click', stamp2:'boom', types:'pop', race:'horn'};
      const dens = set.sfx ?? 1;
      if (dens > 0 && SC_SFX[L.scene] && !(L.fx && ['boom','fry'].includes(L.fx) && SC_SFX[L.scene] === 'boom')) sfx.push({t:t + (L.scene === 'airdrop' ? vd * .55 : .3), type:SC_SFX[L.scene]});
      if (L.scene === 'flags') sfx.push({t:t + .35, type:(L.p.one === 'r' ? 'fail' : 'win')});
      if (dens > 1 && L.role === 'meme' && r() < .5) sfx.push({t:t + vd * .85, type:pick(r, ['bruh','fail','airhorn','win','laser'])});
      if (dens > 1 && k === 0) sfx.push({t:.05, type:pick(r, ['explode','boom','reverse'])});
      if (L.scene === 'quiz' && L.p.ok === undefined) for (let q = 0; q < 4; q++) sfx.push({t:t + .4 + q * .5, type:'tick'});
      if (L.scene === 'quiz' && L.p.ok !== undefined) sfx.push({t:t + .5, type:'boom'});
      if (L.scene === 'phone') (L.p.msgs || []).forEach((m, i) => sfx.push({t:t + .15 + i * Math.min(.55, vd / 3.2), type:'msg'}));
      if (set.tempo === 3 && r() < .35 && flashes < 3 && k > 0) { fx.push({t:t, type:'flash'}); flashes++; }
      // пословные субтитры
      if (tp.chunk && set.delivery !== 'text' && set.delivery !== 'voiceonly' && voiced) {
        const words = clean(L.say).split(' ').filter(Boolean);
        const groups = []; let cur = [];
        const maxC = tp.chunk === 1 ? 8 : 13;
        words.forEach((w) => { if (cur.length && (cur.join(' ') + ' ' + w).length > maxC && cur.join(' ').length > 3) { groups.push(cur.join(' ')); cur = []; }
          cur.push(w); if (/[.!?:,]$/.test(w) || (tp.chunk === 1 && w.length > 4)) { groups.push(cur.join(' ')); cur = []; } });
        if (cur.length) groups.push(cur.join(' '));
        const lens = groups.map((s) => s.length + 3), sum = lens.reduce((a, b) => a + b, 0);
        let acc = 0;
        groups.forEach((g0, i) => { const s = t + .05 + vd * .92 * acc / sum; acc += lens[i]; const e = t + .05 + vd * .92 * acc / sum;
          chunks.push({s, e:i === groups.length - 1 ? it.end : e, text:g0.replace(/[.,!?:;]+$/, '').toUpperCase(), item:k});
          if (set.tempo === 3 && tp.punch && r() < .5) fx.push({t:s, type:'punch'}); });
      }
      t = it.end;
    });
    const genre = set.music && GENRES[set.music] ? set.music : autoGenre(set, rng(seed ^ 0x51ed));
    const bgk = set.bg && set.bg !== 'random' ? set.bg : pick(rng(seed ^ 0xb6), Object.keys(BGS));
    return {dur:t + .35, items, chunks, sfx, fx, set:{...set}, seed, genre, bg:bgk};
  }

  // ---------- новые сцены ----------
  const CREAM = '#FFE9C7', GOLD = '#FFD23F', FIRE = '#FF5A1F';
  function fitFont(txt, size, maxW, fam) { g.font = `${size}px ${fam}`; const w = g.measureText(txt).width; if (w > maxW) { size = Math.floor(size * maxW / w); g.font = `${size}px ${fam}`; } return size; }
  function outlined(txt, x, y, size, fill, fam = '"Russo One"', maxW = 960) {
    size = fitFont(txt, size, maxW, fam); g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = Math.max(6, size * .2); g.strokeStyle = '#000'; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y); return size;
  }
  const fireGrad = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#FFF3D0'); gr.addColorStop(.45, '#FFB347'); gr.addColorStop(1, '#FF2A00'); return gr; };
  const GS = {
    big(u, d, it) { const k = back(u / .28), s = 1 + Math.max(0, .25 - u) * .6; g.save(); g.translate(W / 2, 640); g.rotate(-.04); g.scale(k * s, k * s);
      const rg = g.createRadialGradient(0, 0, 40, 0, 0, 520); rg.addColorStop(0, 'rgba(255,120,0,.45)'); rg.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = rg; g.fillRect(-540, -540, 1080, 1080);
      const words = it.p.t.split(' '); const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [it.p.t];
      lines.forEach((l, i) => outlined(l, 0, (i - (lines.length - 1) / 2) * 170 + 55, 190, fireGrad(-120, 80)));
      g.restore(); },
    stamp2(u, d, it) { const half = d * .45, first = u < half, k = back(((first ? u : u - half)) / .22); g.save(); g.translate(W / 2, 620); g.rotate(-.12); g.scale(k, k);
      g.lineWidth = 16; g.strokeStyle = '#FF2A2A'; g.strokeRect(-390, -150, 780, 300); fitFont(first ? it.p.a : it.p.b, 150, 700, '"Russo One"'); g.textAlign = 'center'; g.fillStyle = '#FF2A2A'; g.fillText(first ? it.p.a : it.p.b, 0, 55); g.restore(); },
    comment(u, d, it) { const k = back((u - .05) / .3); g.save(); g.translate(W / 2, 600); g.scale(k, k); g.rotate(-.04);
      card(-450, -140, 900, 280, '#f3ead9', '#111'); g.fillStyle = '#ff5a1f'; g.fillRect(-405, -100, 44, 44);
      g.font = '28px "Press Start 2P"'; g.textAlign = 'left'; g.fillStyle = '#666'; g.fillText(it.p.who || '@комментарий', -345, -66);
      g.font = '42px "Press Start 2P"'; g.fillStyle = '#111'; (it.p.lines || []).forEach((l, i) => g.fillText(l, -405, 10 + i * 66)); g.restore(); },
    phone(u, d, it) { const msgs = it.p.msgs || []; const step = Math.min(.55, d / 3.2);
      g.save(); g.fillStyle = 'rgba(10,3,3,.72)'; rr(150, 300, 780, 700, 40); g.fill(); g.strokeStyle = '#ff6a3d'; g.lineWidth = 5; g.stroke();
      g.font = '26px "Press Start 2P"'; g.textAlign = 'center'; g.fillStyle = GOLD; g.fillText('СООБЩЕНИЯ', W / 2, 360);
      msgs.forEach((m, i) => { const t0 = .15 + i * step; if (u < t0) return; const k = back((u - t0) / .2); const me = m[0] === 'Я'; const y = 430 + i * 175;
        g.save(); g.translate(me ? 830 : 250, y); g.scale(k, k); g.font = '38px "Press Start 2P"'; const w = Math.max(g.measureText(m[1]).width, 160) + 60;
        g.fillStyle = me ? '#ff5a1f' : '#f3ead9'; rr(me ? -w : 0, 0, w, 120, 26); g.fill();
        g.textAlign = me ? 'right' : 'left'; g.font = '22px "Press Start 2P"'; g.fillStyle = me ? '#3a0a00' : '#777'; g.fillText(m[0], me ? -30 : 30, 38);
        g.font = '38px "Press Start 2P"'; g.fillStyle = me ? '#fff3e0' : '#111'; g.fillText(m[1], me ? -30 : 30, 92); g.restore(); });
      g.restore(); },
    pov(u, d, it) { const k = back(u / .25); g.save(); g.translate(W / 2, 560); g.scale(k, k); outlined('POV:', 0, -60, 200, fireGrad(-200, 0)); g.restore();
      const txt = it.p.t || '', n = Math.floor(clamp((u - .25) / Math.max(.4, d * .5)) * txt.length); g.font = '44px "Press Start 2P"'; g.textAlign = 'center';
      const s = txt.slice(0, n) + ((Math.floor(u * 3) % 2 && n < txt.length) ? '_' : ''); const words = s.split(' '); let line = '', y = 700; const lines = [];
      words.forEach((w) => { if (g.measureText(line + ' ' + w).width > 900) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; }); lines.push(line);
      lines.forEach((l, i) => { g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(l, W / 2, y + i * 64); g.fillStyle = CREAM; g.fillText(l, W / 2, y + i * 64); }); },
    vs(u, d, it) { const k = ease(u / .3), split = d * .45; g.save();
      [['l', -1, '#5a5a5a', '#bbbbbb'], ['r', 1, '#3a0a05', '#FF5A1F']].forEach(([side, dir, bgc, bc], i) => { const t0 = i ? split : 0; if (u < t0) return; const kk = ease((u - t0) / .3);
        const x = W / 2 + dir * 260 + (1 - kk) * dir * 600; g.save(); g.translate(x, 620); g.rotate(dir * .03);
        g.fillStyle = bgc; rr(-240, -230, 480, 460, 24); g.fill(); g.lineWidth = 6; g.strokeStyle = bc; g.stroke();
        const [h, txt] = it.p[side]; g.textAlign = 'center'; fitFont(h, 52, 420, '"Press Start 2P"'); g.fillStyle = i ? GOLD : '#ddd'; g.fillText(h, 0, -140);
        g.font = '36px "Press Start 2P"'; g.fillStyle = i ? CREAM : '#eee'; txt.split(' ').reduce((acc, w) => { const l = acc[acc.length - 1]; if (l && g.measureText(l + ' ' + w).width < 420) acc[acc.length - 1] = l + ' ' + w; else acc.push(w); return acc; }, []).forEach((l, j) => g.fillText(l, 0, -30 + j * 56));
        g.restore(); });
      if (u > split) { const kk = back((u - split) / .2); g.save(); g.translate(W / 2, 620); g.scale(kk, kk); outlined('VS', 0, 30, 120, GOLD); g.restore(); }
      g.restore(); },
    chips(u, d, it) { const items = it.p.items || []; items.forEach((n, i) => { const t0 = .1 + i * Math.min(.45, d * .7 / items.length); if (u < t0) return; const kk = back((u - t0) / .22);
      g.save(); g.translate(W / 2, 420 + i * 150); g.rotate(((i % 2) ? 1 : -1) * .025); g.scale(kk, kk); g.font = '44px "Press Start 2P"'; const w = Math.min(980, g.measureText(n).width + 100);
      card(-w / 2, -55, w, 110, i === items.length - 1 ? '#5a1205' : '#2a0905', i === items.length - 1 ? '#FFD23F' : '#ff2a00'); g.textAlign = 'center'; fitFont(n, 44, w - 60, '"Press Start 2P"'); g.fillStyle = CREAM; g.fillText(n, 0, 18); g.restore(); }); },
    num(u, d, it) { const k = back((u - .05) / .3), pulse = 1 + Math.sin(u * 7) * .03; const rg = g.createRadialGradient(W / 2, 620, 30, W / 2, 620, 520); rg.addColorStop(0, 'rgba(255,140,0,.5)'); rg.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 100, W, 1100);
      g.save(); g.translate(W / 2, 760); g.scale(k * pulse, k * pulse); const s = fitFont(String(it.p.n), 420, 940, '"Russo One"'); g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = s * .08; g.strokeStyle = '#2a0000'; g.strokeText(it.p.n, 0, 0); g.fillStyle = fireGrad(-s * .8, 0); g.fillText(it.p.n, 0, 0); g.restore(); },
    meter(u, d, it) { const v = it.p.v ?? 100, k = ease((u - .2) / Math.max(.6, d * .6)), cur = Math.round(v * k);
      g.save(); g.fillStyle = 'rgba(0,0,0,.6)'; rr(110, 420, 860, 360, 30); g.fill(); g.strokeStyle = '#ff6a3d'; g.lineWidth = 5; g.stroke();
      g.textAlign = 'center'; g.font = '42px "Press Start 2P"'; g.fillStyle = GOLD; g.fillText(it.p.label || 'УРОВЕНЬ', W / 2, 500);
      g.fillStyle = '#2a0905'; rr(170, 560, 740, 90, 18); g.fill(); const gr = g.createLinearGradient(170, 0, 910, 0); gr.addColorStop(0, '#7CFF3B'); gr.addColorStop(.5, '#FFD23F'); gr.addColorStop(1, '#FF2A2A');
      g.fillStyle = gr; rr(170, 560, Math.max(1, 740 * cur / 100), 90, 18); g.fill(); g.font = '64px "Press Start 2P"'; g.fillStyle = CREAM; g.fillText(cur + '%', W / 2, 740);
      if (k >= 1 && v >= 100 && Math.floor(u * 6) % 2) { g.fillStyle = 'rgba(255,0,0,.12)'; g.fillRect(0, 0, W, H); } g.restore(); },
    rate(u, d, it) { g.save(); g.textAlign = 'center'; for (let i = 0; i < 5; i++) { const t0 = .15 + i * .14; if (u < t0) continue; const kk = back((u - t0) / .2); g.save(); g.translate(W / 2 + (i - 2) * 175, 560); g.scale(kk, kk); g.rotate((i - 2) * .06);
      g.font = '150px "DejaVu Sans"'; g.lineWidth = 12; g.strokeStyle = '#2a0000'; g.strokeText('★', 0, 50); g.fillStyle = '#FFD23F'; g.fillText('★', 0, 50); g.restore(); }
      if (u > .9) { const kk = back((u - .9) / .25); g.save(); g.translate(W / 2, 800); g.scale(kk, kk); outlined('10/10', 0, 0, 170, fireGrad(-140, 0)); g.font = '30px "Press Start 2P"'; g.fillStyle = CREAM; g.fillText(it.p.label || '', 0, 70); g.restore(); } g.restore(); },
    dialog(u, d, it) { const k = back(u / .25); g.save(); g.translate(W / 2, 600); g.scale(k, k); g.fillStyle = '#d4d0c8'; g.fillRect(-420, -170, 840, 340); g.fillStyle = '#0a246a'; g.fillRect(-420, -170, 840, 64);
      g.font = '30px "Press Start 2P"'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(it.p.title || 'Внимание', -395, -126); g.fillStyle = '#c0392b'; g.fillRect(352, -160, 52, 44); g.fillStyle = '#fff'; g.fillText('x', 365, -126);
      g.fillStyle = '#111'; g.font = '36px "Press Start 2P"'; g.textAlign = 'center'; g.fillText(it.p.text || '', 0, -20);
      const pressed = u > d * .55; [['ДА', -170], ['НЕТ', 170]].forEach(([b, x], i) => { g.fillStyle = (pressed && !i) ? '#a8a49c' : '#e8e4dc'; g.fillRect(x - 120, 50, 240, 80); g.strokeStyle = '#555'; g.lineWidth = 4; g.strokeRect(x - 120, 50, 240, 80); g.fillStyle = '#111'; g.fillText(b, x, 105); });
      const cx = lerp(300, -150, ease((u - .3) / Math.max(.3, d * .5 - .3))), cy = lerp(260, 110, ease((u - .3) / Math.max(.3, d * .5 - .3))); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 50); g.lineTo(cx + 14, cy + 38); g.lineTo(cx + 34, cy + 36); g.closePath(); g.fill(); g.stroke(); g.restore(); },
    warn(u, d, it) { const k = back(u / .25); g.save(); g.translate(W / 2, 600); g.rotate(-.03); g.scale(k, k);
      g.fillStyle = '#FFD23F'; rr(-450, -200, 900, 400, 30); g.fill(); g.fillStyle = '#111'; for (let x = -450; x < 450; x += 70) { g.save(); g.beginPath(); g.rect(-450, -200, 900, 400); g.clip(); g.fillRect(x, -200, 30, 400); g.restore(); }
      g.fillStyle = '#1a0503'; rr(-410, -160, 820, 320, 22); g.fill(); g.font = '120px "DejaVu Sans"'; g.textAlign = 'center'; g.fillStyle = '#FFD23F'; g.fillText('⚠', 0, -20);
      fitFont(it.p.t || 'ОСТОРОЖНО', 52, 760, '"Press Start 2P"'); g.fillStyle = '#FFE9C7'; g.fillText(it.p.t || 'ОСТОРОЖНО', 0, 100); g.restore();
      if (Math.floor(u * 4) % 2) { g.fillStyle = 'rgba(255,40,0,.08)'; g.fillRect(0, 0, W, H); } },
    reply(u, d, it) { const k = back((u - .05) / .3); g.save(); g.translate(W / 2, 560); g.scale(k, k); g.rotate(-.03);
      card(-450, -150, 900, 300, '#f3ead9', '#111'); g.font = '24px "Press Start 2P"'; g.textAlign = 'left'; g.fillStyle = '#888'; g.fillText('Ответ пользователю @игрок', -400, -95);
      g.fillStyle = '#ff5a1f'; g.fillRect(-405, -70, 44, 44); g.font = '42px "Press Start 2P"'; g.fillStyle = '#111'; (it.p.lines || []).forEach((l, i) => g.fillText(l, -340, -30 + i * 64)); g.restore();
      if (u > .5) { const kk = back((u - .5) / .25); g.save(); g.translate(W / 2 + 300, 760); g.rotate(.08); g.scale(kk, kk); outlined('ОТВЕЧАЕМ', 0, 0, 64, GOLD); g.restore(); } },
    flags(u, d, it) { const one = it.p.one; const rows = one ? [[one, it.p.t]] : [['g', 'что радует'], ['r', 'что больно']];
      rows.forEach(([c, txt], i) => { const t0 = .08 + i * .35; if (u < t0) return; const kk = back((u - t0) / .25); const y = one ? 600 : 480 + i * 260;
        g.save(); g.translate(W / 2, y); g.scale(kk, kk); const col = c === 'g' ? '#3BD46B' : '#FF2A2A';
        g.fillStyle = 'rgba(0,0,0,.6)'; rr(-460, -110, 920, 220, 26); g.fill(); g.lineWidth = 6; g.strokeStyle = col; g.stroke();
        g.fillStyle = '#ddd'; g.fillRect(-400, -80, 12, 170); const wv = Math.sin(u * 6) * 6; g.fillStyle = col; g.beginPath(); g.moveTo(-388, -80); g.lineTo(-250, -60 + wv); g.lineTo(-388, -10); g.closePath(); g.fill();
        g.textAlign = 'left'; g.font = '30px "Press Start 2P"'; g.fillStyle = col; g.fillText(c === 'g' ? 'ЗЕЛЁНЫЙ ФЛАГ' : 'КРАСНЫЙ ФЛАГ', -210, -30);
        fitFont(String(txt).toUpperCase(), 40, 640, '"Press Start 2P"'); g.fillStyle = CREAM; g.fillText(String(txt).toUpperCase(), -210, 40); g.restore(); }); },
    tier(u, d, it) { const rows = [['S+', '#FF2A2A'], ['S', '#FF7A1F'], ['A', '#FFD23F'], ['B', '#7CFF3B'], ['C', '#5AA8FF']];
      g.save(); rows.forEach(([n, col], i) => { const y = 330 + i * 120, k = ease((u - i * .05) / .3); g.globalAlpha = k; g.fillStyle = col; g.fillRect(120, y, 130, 110); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(255, y, 705, 110);
        g.font = '48px "Russo One"'; g.textAlign = 'center'; g.fillStyle = '#111'; g.fillText(n, 185, y + 72);
        if (it.p.row === n && u > .35) { const kk = back((u - .35) / .25); g.save(); g.translate(600, y + 55); g.scale(kk, kk); g.fillStyle = '#2a0905'; rr(-320, -42, 640, 84, 14); g.fill(); g.strokeStyle = col; g.lineWidth = 5; g.stroke();
          fitFont(it.p.t, 40, 600, '"Press Start 2P"'); g.fillStyle = CREAM; g.fillText(it.p.t, 0, 16); g.restore(); } });
      g.restore(); },
    types(u, d, it) { const k = back(u / .28); g.save(); g.translate(W / 2, 600); g.rotate(((it.p.n || 1) % 2 ? -1 : 1) * .03); g.scale(k, k);
      card(-400, -260, 800, 520, '#1f0d0a', '#ff6a3d'); g.font = '30px "Press Start 2P"'; g.textAlign = 'center'; g.fillStyle = GOLD; g.fillText('ТИП №' + (it.p.n || 1), 0, -200);
      const pal = [['#c9805a','#8a4a2a','#3a1a0a','#e8b090'],['#555','#333','#a00','#888'],['#d4a017','#8a6a10','#3a2a05','#fff3c0'],['#7a7a7a','#4a4a4a','#2a2a2a','#aaa']][(it.p.n || 1) - 1] || ['#c9805a','#8a4a2a','#3a1a0a','#e8b090'];
      const r0 = rng(it.p.n * 99 + 7); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = pal[Math.floor(r0() * pal.length)]; g.fillRect(-120 + i * 30, -160 + j * 30, 30, 30); }
      g.fillStyle = '#fff'; g.fillRect(-75, -70, 30, 15); g.fillRect(45, -70, 30, 15);
      fitFont(it.p.name, 64, 700, '"Russo One"'); g.fillStyle = CREAM; g.fillText(it.p.name, 0, 160); g.font = '30px "Press Start 2P"'; g.fillStyle = '#C9A58B'; g.fillText(it.p.d || '', 0, 220); g.restore(); },
    quiz(u, d, it) { const a = it.p.a || [], ok = it.p.ok; g.save(); g.textAlign = 'center'; const k = back(u / .25); g.save(); g.translate(W / 2, 400); g.scale(k, k); fitFont(it.p.q, 50, 900, '"Press Start 2P"'); g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(it.p.q, 0, 0); g.fillStyle = GOLD; g.fillText(it.p.q, 0, 0); g.restore();
      a.forEach((txt, i) => { const t0 = .2 + i * .15; if (u < t0) return; const kk = back((u - t0) / .2); const reveal = ok !== undefined && u > .5, right = reveal && i === ok, wrong = reveal && i !== ok;
        g.save(); g.translate(W / 2, 540 + i * 140); g.scale(kk, kk); g.globalAlpha = wrong ? .35 : 1; g.fillStyle = right ? '#3a0505' : '#2a0905'; rr(-380, -55, 760, 110, 18); g.fill(); g.lineWidth = right ? 8 : 4; g.strokeStyle = right ? '#FF2A2A' : '#ff6a3d'; g.stroke();
        g.font = '44px "Press Start 2P"'; g.fillStyle = right ? '#FF4A3A' : CREAM; g.fillText(['A', 'B', 'C'][i] + ') ' + txt, 0, 16); g.restore(); });
      if (ok === undefined) { const left = Math.max(0, 5 - Math.floor(u * 2)); g.font = '60px "Press Start 2P"'; g.fillStyle = '#FF5A1F'; g.fillText(String(left), W / 2, 1000); }
      g.restore(); },
    day(u, d, it) { const k = back(u / .25); g.save(); g.translate(W / 2, 600); g.rotate(-.025); g.scale(k, k);
      card(-420, -230, 840, 460, '#1f0d0a', '#ff6a3d'); g.fillStyle = '#ff2a00'; rr(-420, -230, 840, 120, 18); g.fill();
      g.textAlign = 'center'; fitFont(it.p.d || '', 56, 760, '"Press Start 2P"'); g.fillStyle = '#FFE9C7'; g.fillText(it.p.d || '', 0, -150);
      fitFont(it.p.t || '', 72, 760, '"Russo One"'); g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(it.p.t || '', 0, 40); g.fillStyle = fireGrad(-40, 40); g.fillText(it.p.t || '', 0, 40);
      g.font = '40px "Press Start 2P"'; g.fillStyle = (Math.floor(u * 2) % 2) ? GOLD : '#FF7A1F'; g.fillText('19:00', 0, 160); g.restore(); },
    rank(u, d, it) { const k = back(u / .3); g.save(); g.translate(W / 2, 560); g.scale(k, k);
      const rg = g.createRadialGradient(0, 0, 20, 0, 0, 380); rg.addColorStop(0, 'rgba(255,190,40,.5)'); rg.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = rg; g.fillRect(-540, -500, 1080, 1000);
      outlined('№' + (it.p.n || '1'), 0, 60, 300, fireGrad(-220, 60)); g.restore();
      if (it.p.t && u > .3) { const kk = back((u - .3) / .25); g.save(); g.translate(W / 2, 830); g.scale(kk, kk); g.font = '44px "Press Start 2P"'; const w = Math.min(980, g.measureText(it.p.t).width + 90);
        card(-w / 2, -55, w, 110, '#2a0905', '#FFD23F'); g.textAlign = 'center'; fitFont(it.p.t, 44, w - 60, '"Press Start 2P"'); g.fillStyle = CREAM; g.fillText(it.p.t, 0, 16); g.restore(); } },
    case(u, d, it) { const open = clamp((u - .45) / .3), sh = u < .45 ? Math.sin(u * 60) * 8 * (u / .45) : 0; g.save(); g.translate(W / 2 + sh, 640);
      if (open > 0) { g.save(); g.globalAlpha = open; for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * 6.28 + u); g.fillStyle = i % 2 ? 'rgba(255,210,63,.35)' : 'rgba(255,90,31,.25)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, -520); g.lineTo(40, -520); g.closePath(); g.fill(); g.restore(); } g.restore(); }
      g.fillStyle = '#5a2a10'; g.fillRect(-170, -40, 340, 200); g.fillStyle = '#8a4a1a'; g.fillRect(-170, -40, 340, 30); g.fillStyle = '#FFD23F'; g.fillRect(-25, 10, 50, 50);
      g.save(); g.translate(0, -40); g.rotate(-open * .7); g.fillStyle = '#6b3414'; g.fillRect(-170, -90, 340, 90); g.restore();
      if (open >= 1) { const kk = back((u - .75) / .25); g.save(); g.translate(0, -260); g.scale(kk, kk); outlined(it.p.t || 'ЛЕГЕНДАРКА', 0, 0, 90, fireGrad(-70, 0)); g.restore(); }
      g.restore(); },
    guide(u, d, it) { const items = it.p.items || []; g.save(); g.fillStyle = 'rgba(0,0,0,.6)'; rr(140, 330, 800, 120 + items.length * 120, 30); g.fill(); g.strokeStyle = '#ff6a3d'; g.lineWidth = 5; g.stroke();
      g.font = '34px "Press Start 2P"'; g.textAlign = 'center'; g.fillStyle = GOLD; g.fillText('ПЛАН НОВИЧКА', W / 2, 400);
      items.forEach((n, i) => { const t0 = .15 + i * Math.min(.4, d / (items.length + 1)); if (u < t0) return; const kk = ease((u - t0) / .2), y = 490 + i * 120, done = it.p.on !== undefined ? i < it.p.on || (i === it.p.on && u > t0 + .4) : u > t0 + .5;
        g.globalAlpha = kk; g.strokeStyle = CREAM; g.lineWidth = 6; g.strokeRect(200, y - 40, 60, 60); if (done) { g.strokeStyle = '#7CFF3B'; g.lineWidth = 10; g.beginPath(); g.moveTo(210, y - 10); g.lineTo(228, y + 10); g.lineTo(255, y - 35); g.stroke(); }
        g.textAlign = 'left'; fitFont(n, 40, 620, '"Press Start 2P"'); g.fillStyle = CREAM; g.fillText(n, 300, y + 10); g.globalAlpha = 1; }); g.restore(); },
    mic(u, d, it) { const k = back(u / .3); g.save(); g.translate(W / 2, 600); g.scale(k, k);
      for (let i = 0; i < 4; i++) { const r0 = ((u * 260 + i * 110) % 440); g.strokeStyle = `rgba(124,255,59,${clamp(1 - r0 / 440) * .8})`; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 120 + r0, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(0, 0, 120 + r0, Math.PI - 0.9, Math.PI + 0.9); g.stroke(); }
      g.fillStyle = '#1f0d0a'; rr(-70, -150, 140, 220, 70); g.fill(); g.strokeStyle = '#7CFF3B'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#7CFF3B'; g.fillRect(-8, 80, 16, 70); g.fillRect(-60, 150, 120, 14);
      for (let i = 0; i < 9; i++) { const h = 20 + Math.abs(Math.sin(u * 12 + i)) * 60; g.fillStyle = '#7CFF3B'; g.fillRect(-180 + i * 45, 260 - h / 2, 26, h); } g.restore(); },
    askq(u, d, it) { const k = back((u - .05) / .3); g.save(); g.translate(W / 2, 600); g.scale(k, k); card(-430, -120, 860, 240, '#f3ead9', '#111'); g.fillStyle = '#ff5a1f'; g.fillRect(-390, -85, 40, 40);
      g.font = '28px "Press Start 2P"'; g.textAlign = 'left'; g.fillStyle = '#666'; g.fillText('@ты', -335, -52); fitFont(it.p.t || '', 40, 780, '"Press Start 2P"'); g.fillStyle = '#111'; g.fillText(it.p.t || '', -390, 30);
      for (let i = 0; i < 3; i++) { g.fillStyle = (Math.floor(u * 4) % 3 === i) ? '#111' : '#bbb'; g.fillRect(-390 + i * 42, 62, 24, 24); } g.restore(); },
  };
  function drawScene(it, u, d) {
    const fn = GS[it.scene] || SC[it.scene === 'countdown' ? 'countdown' : it.scene];
    if (fn) fn(u, d, Object.assign({lines:it.p.lines, chips:it.p.chips, n:it.p.n, unit:''}, it));
  }

  // ---------- субтитры ----------
  function capStyle(style, txt, y, size, hot, rot) {
    g.save(); g.translate(W / 2, y); g.rotate(rot || 0);
    if (style === 'pixel') { size = fitFont(txt, Math.round(size * .55), 980, '"Press Start 2P"'); g.textAlign = 'center'; g.lineWidth = size * .35; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.strokeText(txt, 0, 0); g.fillStyle = hot ? GOLD : CREAM; g.fillText(txt, 0, 0); }
    else if (style === 'meme') { size = fitFont(txt, size, 980, '"Russo One"'); g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * .28; g.strokeStyle = '#000'; g.strokeText(txt, 0, 0); g.fillStyle = hot ? '#FFE600' : '#FFFFFF'; g.fillText(txt, 0, 0); }
    else { size = fitFont(txt, size, 980, '"Russo One"'); g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * .22; g.strokeStyle = '#000'; g.strokeText(txt, 0, 0); g.fillStyle = hot ? fireGrad(-size * .7, size * .2) : '#FFF3E0'; g.fillText(txt, 0, 0); }
    g.restore();
  }
  function captions(tl, t, it, u) {
    const st = tl.set.caption; if (tl.set.delivery === 'voiceonly') return;
    if (tl.chunks.length) {
      let c = null, ci = 0; for (let i = 0; i < tl.chunks.length; i++) if (t >= tl.chunks[i].s) { c = tl.chunks[i]; ci = i; }
      if (!c || t > c.e) return; const cu = t - c.s, k = back(cu / .12);
      g.save(); g.translate(W / 2, 1150); g.scale(k, k); g.translate(-W / 2, -1150);
      capStyle(st, c.text, 1150, 150, ci % 2 === 1, ((ci % 3) - 1) * .035); g.restore();
      // огромное эхо слова на фоне
      if (tl.set.echoWord) { g.save(); g.globalAlpha = .05; g.font = '300px "Russo One"'; g.textAlign = 'center'; g.fillStyle = ci % 2 ? '#ff5a1f' : '#fff'; g.fillText(c.text.split(' ')[0], W / 2, 1460); g.restore(); }
    } else {
      if (t > it.end) return; const [l1, l2] = it.caps; const k = back(u / .22);
      g.save(); g.translate(W / 2, 1100); g.scale(k, k); g.translate(-W / 2, -1100);
      if (l1) capStyle(st, l1, l2 ? 1080 : 1140, l1.length > 12 ? 92 : 108, false, 0);
      if (l2) capStyle(st, l2, 1200, l2.length > 13 ? 100 : 116, true, 0);
      g.restore();
    }
  }

  // ---------- фоны ----------
  const EMB = Array.from({length:90}, (_, i) => { const r0 = rng(i * 7 + 3); return [r0() * W, r0() * H, 1 + r0() * 3, .3 + r0() * .7, r0() * 6.28]; });
  function embers(t, col, sp = 60) { for (const [x, y, s0, a, p] of EMB) { const yy = (y - t * sp * a + H * 4) % H, xx = x + Math.sin(t + p) * 20; g.fillStyle = col(a); g.fillRect(xx, yy, s0 * 2, s0 * 2); } }
  function vign(a = .6) { const vg = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  function ground(t, c1, c2) { for (let x = 0; x < W; x += 90) for (let y = 1500; y < H; y += 90) g.drawImage(NETH, x, y, 90, 90); g.fillStyle = c1; g.fillRect(0, 1500, W, H - 1500); for (let x = 0; x < W; x += 18) { const v = Math.sin(x * .03 + t * 3) * .5 + .5; g.fillStyle = c2(v); g.fillRect(x, 1478, 18, 22); } }
  const BGS = {
    hell(t) { bg(t); },
    cave(t) { const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#0d0302'); sk.addColorStop(.6, '#2a0804'); sk.addColorStop(1, '#5a1204'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1a0605'; for (let i = 0; i < 14; i++) { const x = i * 80 + 20, h = 120 + Math.abs(Math.sin(i * 7.3)) * 260; g.beginPath(); g.moveTo(x - 40, 0); g.lineTo(x + 40, 0); g.lineTo(x, h); g.closePath(); g.fill(); }
      for (const x of [140, 920]) { const lg = g.createLinearGradient(x - 30, 0, x + 30, 0); lg.addColorStop(0, 'rgba(255,90,0,0)'); lg.addColorStop(.5, `rgba(255,${140 + Math.sin(t * 4 + x) * 30 | 0},0,.85)`); lg.addColorStop(1, 'rgba(255,90,0,0)'); g.fillStyle = lg; g.fillRect(x - 30, 0, 60, 1500); }
      ground(t, 'rgba(60,8,2,.35)', (v) => `rgb(255,${90 + v * 110 | 0},${v * 40 | 0})`); embers(t, (a) => `rgba(255,${140 + a * 80 | 0},60,${a * .7})`); vign(); },
    moon(t) { const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#120203'); sk.addColorStop(.5, '#3a0508'); sk.addColorStop(1, '#14040a'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
      const mx = W / 2 + Math.sin(t * .1) * 40, my = 520; const mg = g.createRadialGradient(mx, my, 60, mx, my, 520); mg.addColorStop(0, 'rgba(255,60,40,.55)'); mg.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = mg; g.fillRect(0, 0, W, 1200);
      g.fillStyle = '#c4161c'; g.beginPath(); g.arc(mx, my, 210, 0, 6.28); g.fill(); g.fillStyle = 'rgba(90,0,0,.35)'; for (const [dx, dy, rr0] of [[-60, -40, 40], [50, 30, 55], [-20, 90, 28]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr0, 0, 6.28); g.fill(); }
      g.fillStyle = '#0a0203'; g.beginPath(); g.moveTo(0, 1500); for (let x = 0; x <= W; x += 60) g.lineTo(x, 1250 + Math.sin(x * .011) * 90 + Math.sin(x * .031) * 40); g.lineTo(W, 1500); g.closePath(); g.fill();
      ground(t, 'rgba(30,0,4,.5)', (v) => `rgb(${200 + v * 55 | 0},${20 + v * 40 | 0},20)`); embers(t, (a) => `rgba(255,${60 + a * 60 | 0},50,${a * .6})`, 30); vign(.7); },
    ash(t) { const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#2a2422'); sk.addColorStop(.6, '#4a3a33'); sk.addColorStop(1, '#3a1f12'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
      for (let l = 0; l < 3; l++) { g.fillStyle = `rgba(${60 + l * 20},${50 + l * 15},${45 + l * 10},.5)`; g.beginPath(); g.moveTo(0, 1500); for (let x = 0; x <= W; x += 40) g.lineTo(x, 1050 + l * 140 + Math.sin(x * .008 + l + t * .2) * 60); g.lineTo(W, 1500); g.closePath(); g.fill(); }
      ground(t, 'rgba(50,40,36,.55)', (v) => `rgb(${150 + v * 60 | 0},${70 + v * 50 | 0},40)`); for (let i = 0; i < 3; i++) embers(t * (1 + i * .3), (a) => `rgba(200,190,180,${a * .5})`, 40); vign(.5); },
    void(t) { g.fillStyle = '#050101'; g.fillRect(0, 0, W, H); for (let i = 0; i < 160; i++) { const r0 = rng(i + 11); const x = r0() * W, y = r0() * 1500, tw = .3 + .7 * Math.abs(Math.sin(t * 2 + i)); g.fillStyle = `rgba(255,${150 + r0() * 100 | 0},90,${tw * .8})`; g.fillRect(x, y, 3, 3); }
      for (let i = 0; i < 5; i++) { const r0 = rng(i * 31 + 5); const x = r0() * W, y = 300 + r0() * 900 + Math.sin(t * .8 + i) * 25, w = 120 + r0() * 160; g.fillStyle = '#1a0c10'; g.fillRect(x - w / 2, y, w, 40); g.fillStyle = '#2a1418'; g.fillRect(x - w / 2 + 20, y + 40, w - 40, 40); g.fillStyle = 'rgba(255,90,31,.6)'; g.fillRect(x - w / 2, y, w, 5); }
      ground(t, 'rgba(10,2,2,.7)', (v) => `rgb(${180 + v * 60 | 0},${60 + v * 60 | 0},20)`); vign(.7); },
    lava(t) { const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#1a0202'); sk.addColorStop(.45, '#4a0a03'); sk.addColorStop(1, '#ff5a00'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
      for (let row = 0; row < 14; row++) { const y = 1000 + row * 70; for (let x = -100; x < W + 100; x += 60) { const v = Math.sin(x * .02 + row + t * 2) * .5 + .5; g.fillStyle = `rgba(255,${80 + v * 140 | 0},${v * 40 | 0},${.25 + row * .05})`; g.fillRect(x + Math.sin(t + row) * 30, y + Math.sin(x * .05 + t * 3) * 10, 62, 36); } }
      embers(t, (a) => `rgba(255,${180 + a * 70 | 0},90,${a})`, 120); vign(.55); },
  };
  // ---------- 3D: пол с перспективой, пролёт камеры, летящие блоки ----------
  function threeD(t, set) { const sp = {1:.6, 2:1, 3:1.7}[set.tempo], hz = 980, cx = W / 2 + Math.sin(t * .4) * 120;
    g.save(); g.globalAlpha = .55; g.strokeStyle = '#FF5A1F'; g.lineWidth = 3;
    for (let i = 0; i < 22; i++) { const z = ((i - (t * sp * 2) % 1) / 22); if (z <= 0) continue; const y = hz + (1500 - hz) * (1 / (1 + (1 - z) * 6)) * 1.0; g.globalAlpha = .15 + z * .45; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = .4; for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(cx + i * 40, hz); g.lineTo(cx + i * 420, 1500); g.stroke(); } g.restore();
    for (let i = 0; i < 9; i++) { const r0 = rng(i * 17 + 1), side = i % 2 ? 1 : -1; const z = ((r0() + t * sp * .25) % 1), sc = .2 + z * z * 3.2, x = W / 2 + side * (180 + z * z * 900), y = hz - 180 * sc + 200 * z;
      g.save(); g.globalAlpha = Math.min(1, z * 2); g.translate(x, y); g.rotate(t * (1 + i * .2) * side * .5); const s0 = 70 * sc; g.drawImage(i % 3 ? BASALT : NETH, -s0 / 2, -s0 / 2, s0, s0); g.strokeStyle = 'rgba(255,90,31,.7)'; g.lineWidth = 2; g.strokeRect(-s0 / 2, -s0 / 2, s0, s0); g.restore(); }
  }
  // ---------- персонаж-рассказчик ----------
  const MASCOTS = {
    imp:   {pal:{'r':'#c4161c','d':'#7a0a0e','h':'#2a0505','y':'#FFD23F','w':'#fff','k':'#111','m':'#3a0505'}, px:['..h......h..','..hh....hh..','...rrrrrr...','..rrrrrrrr..','.rrwkrrwkrr.','.rrrrrrrrrr.','.rrrMMMMrrr.','..rrrrrrrr..','...dddddd...','..dd.dd.dd..','..d..dd..d..','.dd..dd..dd.']},
    skull: {pal:{'r':'#e8e0d0','d':'#a89f90','h':'#e8e0d0','y':'#FF5A1F','w':'#FF5A1F','k':'#111','m':'#111'}, px:['............','...rrrrrr...','..rrrrrrrr..','.rrrrrrrrrr.','.rkkrrrrkkr.','.rkwrrrrwkr.','.rrrrkkrrrr.','..rrMMMMrr..','...rdrdrr...','....dddd....','...d.dd.d...','..d..dd..d..']},
    knight:{pal:{'r':'#6a6a74','d':'#3a3a44','h':'#FF5A1F','y':'#FFD23F','w':'#FF5A1F','k':'#111','m':'#111'}, px:['.....hh.....','....hhhh....','...rrrrrr...','..rrrrrrrr..','..rkwkkwkr..','..rrrrrrrr..','..rrMMMMrr..','...rrrrrr...','..dddddddd..','.ddyddddydd.','.dd.dddd.dd.','.d..dddd..d.']},
    cat:   {pal:{'r':'#1a1414','d':'#0d0a0a','h':'#1a1414','y':'#FFD23F','w':'#FF8A1F','k':'#111','m':'#5a1010'}, px:['.h......h...','.hh....hh...','.rrrrrrrr...','rrrrrrrrrr..','rwkrrrrwkr..','rrrrrrrrrr..','rrrMMMMrrr..','.rrrrrrrr...','..dddddd..d.','..dddddd.d..','..d.dd.dd...','.dd.dd.dd...']},
  };
  function mascot(tl, t, it, set) { const M = MASCOTS[set.mascot]; if (!M) return;
    const talking = it.voiced && t >= it.voiceAt && t <= it.voiceAt + it.vd ? Math.sin(t * 24) > -.2 : (set.delivery === 'text' && t < it.end - .3 ? Math.sin(t * 9) > .6 : false);
    let jump = 0, laugh = byId[it.id] && byId[it.id].role === 'meme' && t - it.start > it.vd * .7; for (const f of tl.fx) { const a = t - f.t; if (a > 0 && a < .4 && ['boom','airhorn','record'].includes(f.type)) jump = Math.sin(a / .4 * Math.PI) * 60; }
    const s0 = 18, x0 = 56, y0 = 1478 - 12 * s0 - jump + Math.sin(t * 3) * 4; g.save();
    M.px.forEach((row, j) => [...row].forEach((ch, i) => { let c = ch; if (c === '.') return; if (c === 'M') c = talking ? 'm' : 'r'; if (laugh && (c === 'k')) c = 'y'; g.fillStyle = M.pal[c] || '#000'; g.fillRect(x0 + i * s0, y0 + j * s0, s0, s0); }));
    if (talking && it.voiced) { g.fillStyle = 'rgba(255,233,199,.9)'; for (let k = 0; k < 3; k++) { const a = (t * 3 + k * .33) % 1; g.globalAlpha = 1 - a; g.fillRect(x0 + 12 * s0 + 10 + a * 40, y0 + 40 - a * 30 + k * 12, 10, 10); } g.globalAlpha = 1; }
    g.restore(); }

  // ---------- эффекты кадра ----------
  const cv = () => g.canvas; const OFF = document.createElement('canvas');
  function active(tl, t, type, len) { return tl.fx.filter((f) => f.type === type && t >= f.t && t < f.t + len); }
  const PAL = {hell:null, blood:['rgba(255,0,30,.16)','multiply'], gold:['rgba(255,190,40,.14)','overlay'], ash:['saturate(.45) contrast(1.15)','filter'], toxic:['hue-rotate(-25deg) saturate(1.3)','filter']};

  function renderFrame(tl, t) {
    const items = tl.items; let k = 0; for (let i = 0; i < items.length; i++) if (t >= items[i].start) k = i;
    const it = items[k], u = t - it.start, d = it.end - it.start, set = tl.set;
    // тряска
    let sx = 0, sy = 0, sc = 1, rot = it.tilt * Math.max(0, 1 - u / .4) * (set.tempo > 1 ? 1 : 0);
    for (const f of tl.fx) { const a = t - f.t; if (a < 0) continue;
      if ((f.type === 'boom' || f.type === 'airhorn') && a < .45) { const p = 1 - a / .45; sx += Math.sin(t * 95) * 22 * p; sy += Math.cos(t * 81) * 18 * p; sc += .08 * p; }
      if (f.type === 'punch' && a < .18) { sc += .07 * (1 - a / .18); }
      if (f.type === 'zoom' && a < 1.2) sc += .18 * ease(a / .35) * (1 - clamp((a - .8) / .4));
      if (f.type === 'dramatic' && a < 2) sc += .06 * ease(a / 2);
      if (f.type === 'record' && a < .35) rot += Math.sin(a * 60) * .02;
    }
    // переход
    let tx = 0, alpha = 1;
    if (k > 0 && u < .3) { const p = 1 - ease(u / .3);
      if (it.trans === 'whip') tx = p * W * .6 * (k % 2 ? 1 : -1);
      else if (it.trans === 'slide') sy += p * 500;
      else if (it.trans === 'zoom') sc += p * .35;
      else if (it.trans === 'spin') rot += p * .5 * (k % 2 ? 1 : -1);
      else if (it.trans === 'fade') alpha = 1 - p; }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(W / 2 + sx + tx, H / 2 + sy); g.rotate(rot); g.scale(sc, sc); g.translate(-W / 2, -H / 2);
    const bt = t * (set.tempo === 3 ? 1.8 : set.tempo === 2 ? 1.3 : 1); (BGS[tl.bg] || BGS.hell)(bt); if (set.d3) threeD(t, set); header();
    if (set.d3 && u < .45) { const a = 1 - ease(u / .45); g.translate(W / 2, 700); g.transform(Math.max(.05, Math.cos(a * 1.2)), Math.sin(a * 1.2) * .25 * (k % 2 ? 1 : -1), 0, 1, 0, 0); g.translate(-W / 2, -700); }
    if (it.trans === 'flip' && k > 0 && u < .3) { const p0 = 1 - ease(u / .3); g.translate(W / 2, 0); g.scale(Math.max(.03, 1 - p0), 1); g.translate(-W / 2, 0); }
    drawScene(it, u, d);
    g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); mascot(tl, t, it, set); g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); captions(tl, t, it, u); g.restore();
    if (alpha < 1) { g.fillStyle = `rgba(0,0,0,${1 - alpha})`; g.fillRect(0, 0, W, H); }
    // пост-эффекты
    const C = cv();
    for (const f of active(tl, t, 'fry', .9)) { const a = t - f.t; g.save(); g.filter = 'saturate(4) contrast(1.9) brightness(1.08)'; g.drawImage(C, 0, 0); g.filter = 'none'; g.restore();
      g.save(); g.translate(W / 2, 330); g.rotate(-.08); outlined('ЖАРКО', 0, 0, 110, '#FFE600'); g.restore(); }
    if ((it.trans === 'glitch' && k > 0 && u < .25) || active(tl, t, 'record', .3).length) { const r = rng(Math.floor(t * 30) + 7); g.save();
      for (let i = 0; i < 9; i++) { const y = r() * H, h = 20 + r() * 120, dx = (r() - .5) * 120; g.drawImage(C, 0, y, W, h, dx, y, W, h); }
      g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,0,60,.10)'; g.fillRect(0, 0, W, H); g.restore(); }
    if (k > 0 && u < .35 && ['burn','pixel','shatter'].includes(it.trans)) { const p0 = 1 - u / .35;
      if (it.trans === 'pixel') { const n = Math.max(10, Math.round(14 + 200 * (1 - p0) * (1 - p0))); OFF.width = n; OFF.height = Math.round(n * 16 / 9); const o2 = OFF.getContext('2d'); o2.imageSmoothingEnabled = false; o2.drawImage(C, 0, 0, OFF.width, OFF.height); g.save(); g.imageSmoothingEnabled = false; g.drawImage(OFF, 0, 0, W, H); g.restore(); }
      if (it.trans === 'shatter') { OFF.width = W; OFF.height = H; OFF.getContext('2d').drawImage(C, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const r0 = rng(k * 99); for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 5; gx++) { const dx = (r0() - .5) * 600 * p0, dy = (r0() - .5) * 600 * p0, tw = W / 5, th = H / 8; g.save(); g.globalAlpha = 1 - p0 * .6; g.translate(gx * tw + tw / 2 + dx, gy * th + th / 2 + dy); g.rotate((r0() - .5) * p0); g.drawImage(OFF, gx * tw, gy * th, tw, th, -tw / 2, -th / 2, tw, th); g.restore(); } }
      if (it.trans === 'burn') { const y = H * (1 - ease(1 - p0)); g.fillStyle = '#0a0202'; g.fillRect(0, 0, W, y); const fg = g.createLinearGradient(0, y - 40, 0, y + 120); fg.addColorStop(0, 'rgba(255,230,120,.95)'); fg.addColorStop(.4, 'rgba(255,90,0,.8)'); fg.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = fg; for (let x = 0; x < W; x += 30) { const h0 = 60 + Math.abs(Math.sin(x * .07 + t * 20)) * 90; g.fillRect(x, y - h0 * .5, 30, h0 + 60); } } }
    for (const f of active(tl, t, 'dramatic', 2)) { const a = t - f.t; const vg = g.createRadialGradient(W / 2, 700, 200, W / 2, 700, 1000); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${.65 * clamp(a / .4)})`); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    for (const f of active(tl, t, 'flash', .12)) { g.fillStyle = `rgba(255,220,180,${.55 * (1 - (t - f.t) / .12)})`; g.fillRect(0, 0, W, H); }
    for (const f of tl.fx) { if (f.type !== 'sticker') continue; const a = t - f.t; if (a < 0 || a > 1.6) continue; const kk = back(a / .18) * (a > 1.4 ? 1 - (a - 1.4) / .2 : 1);
      g.save(); g.translate(W * f.x, 900); g.rotate(f.rot); g.scale(kk, kk); g.font = '40px "Press Start 2P"'; const w = g.measureText(f.text).width + 60;
      g.fillStyle = '#fff'; rr(-w / 2, -50, w, 90, 12); g.fill(); g.lineWidth = 6; g.strokeStyle = '#111'; g.stroke(); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(f.text, 0, 12); g.restore(); }
    // цвет
    const p = PAL[set.palette];
    if (p) { g.save(); if (p[1] === 'filter') { g.filter = p[0]; g.drawImage(C, 0, 0); g.filter = 'none'; } else { g.globalCompositeOperation = p[1]; g.fillStyle = p[0]; g.fillRect(0, 0, W, H); } g.restore(); }
    // полоса прогресса
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, W, 8); g.fillStyle = '#ff5a1f'; g.fillRect(0, 0, W * Math.min(1, t / tl.dur), 8);
  }

  // ---------- звук ----------
  function noiseBuf(ac, sec) { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * sec), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function env(ac, node, t, peak, att, dec, out) { const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + att); gn.gain.exponentialRampToValueAtTime(0.0001, t + att + dec); node.connect(gn); gn.connect(out); return gn; }
  function osc(ac, type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + .05); return o; }
  function noise(ac, t, dur, nb) { const s = ac.createBufferSource(); s.buffer = nb; s.start(t, Math.random() * .5, dur + .05); return s; }
  const SFX = {
    boom(ac, t, out, nb) { const o = osc(ac, 'sine', 120, t, 1.1); o.frequency.exponentialRampToValueAtTime(38, t + .9); const sh = ac.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); } sh.curve = c; o.connect(sh); env(ac, sh, t, .9, .01, 1.0, out);
      const n = noise(ac, t, .08, nb); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; n.connect(f); env(ac, f, t, .4, .002, .08, out); },
    whoosh(ac, t, out, nb) { const n = noise(ac, t, .35, nb); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(4000, t + .3); n.connect(f); env(ac, f, t, .35, .15, .2, out); },
    record(ac, t, out, nb) { const n = noise(ac, t, .45, nb); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4; f.frequency.setValueAtTime(2500, t); f.frequency.linearRampToValueAtTime(400, t + .12); f.frequency.linearRampToValueAtTime(3000, t + .25); f.frequency.linearRampToValueAtTime(300, t + .4); n.connect(f); env(ac, f, t, .7, .01, .42, out); },
    airhorn(ac, t, out) { for (const [s, l] of [[0, .22], [.28, .5]]) for (const fr of [466, 554, 698]) { const o = osc(ac, 'sawtooth', fr, t + s, l); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; o.connect(f); env(ac, f, t + s, .09, .02, l, out); } },
    ding(ac, t, out) { for (const [fr, v] of [[1320, .22], [1980, .1]]) { const o = osc(ac, 'sine', fr, t, .9); env(ac, o, t, v, .005, .8, out); } },
    pop(ac, t, out) { const o = osc(ac, 'sine', 600, t, .15); o.frequency.exponentialRampToValueAtTime(1500, t + .06); env(ac, o, t, .35, .003, .1, out); },
    msg(ac, t, out) { const o = osc(ac, 'triangle', 880, t, .2); o.frequency.setValueAtTime(1320, t + .07); env(ac, o, t, .22, .004, .16, out); },
    zoom(ac, t, out, nb) { SFX.whoosh(ac, t, out, nb); },
    fry(ac, t, out, nb) { SFX.boom(ac, t, out, nb); },
    dramatic(ac, t, out) { for (const fr of [55, 82.4]) { const o = osc(ac, 'sawtooth', fr, t, 1.4); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; o.connect(f); env(ac, f, t, .12, .4, .9, out); } },
    coin(ac, t, out) { for (const [f, dt] of [[988, 0], [1319, .07]]) { const o = osc(ac, 'square', f, t + dt, .2); env(ac, o, t + dt, .08, .002, .18, out); } },
    levelup(ac, t, out) { [523, 659, 784, 1047, 1319].forEach((f, i) => { const o = osc(ac, 'square', f, t + i * .07, .2); env(ac, o, t + i * .07, .07, .003, .18, out); }); },
    win(ac, t, out) { [[523, 0], [659, .1], [784, .2], [1047, .32]].forEach(([f, dt]) => { const o = osc(ac, 'sawtooth', f, t + dt, .35); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2500; o.connect(fl); env(ac, fl, t + dt, .07, .01, .32, out); }); },
    fail(ac, t, out) { [[392, 0], [370, .25], [349, .5], [330, .75]].forEach(([f, dt], i) => { const o = osc(ac, 'sawtooth', f, t + dt, i === 3 ? .9 : .25); if (i === 3) o.frequency.linearRampToValueAtTime(300, t + dt + .8); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1200; o.connect(fl); env(ac, fl, t + dt, .08, .02, i === 3 ? .85 : .22, out); }); },
    bruh(ac, t, out) { const o = osc(ac, 'sawtooth', 140, t, .7); o.frequency.exponentialRampToValueAtTime(70, t + .6); const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 3; o.connect(f1); env(ac, f1, t, .5, .03, .6, out); },
    laser(ac, t, out) { const o = osc(ac, 'square', 2400, t, .3); o.frequency.exponentialRampToValueAtTime(200, t + .25); env(ac, o, t, .07, .002, .25, out); },
    explode(ac, t, out, nb) { const n = noise(ac, t, 1.4, nb); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(3000, t); fl.frequency.exponentialRampToValueAtTime(120, t + 1.2); n.connect(fl); env(ac, fl, t, .9, .005, 1.3, out); SFX.boom(ac, t, out, nb); },
    reverse(ac, t, out, nb) { const n = noise(ac, t, .8, nb); const fl = ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 2500; n.connect(fl); const gn = ac.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(.35, t + .75); gn.gain.linearRampToValueAtTime(.0001, t + .8); fl.connect(gn); gn.connect(out); },
    rise(ac, t, out) { const o = osc(ac, 'sawtooth', 200, t, 1); o.frequency.exponentialRampToValueAtTime(1200, t + .9); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1800; o.connect(fl); env(ac, fl, t, .05, .3, .6, out); },
    siren(ac, t, out) { const o = osc(ac, 'sawtooth', 600, t, .85); for (let i = 0; i < 2; i++) { o.frequency.linearRampToValueAtTime(900, t + i * .4 + .2); o.frequency.linearRampToValueAtTime(600, t + i * .4 + .4); } const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1500; o.connect(fl); env(ac, fl, t, .04, .05, .75, out); },
    alarm(ac, t, out) { for (let i = 0; i < 3; i++) { const o = osc(ac, 'square', 880, t + i * .22, .14); env(ac, o, t + i * .22, .06, .002, .12, out); } },
    bell(ac, t, out) { for (const [f, v] of [[220, .12], [440 * 1.19, .06], [660 * 1.41, .03]]) { const o = osc(ac, 'sine', f, t, 1.1); env(ac, o, t, v, .003, .9, out); } },
    shield(ac, t, out) { for (const f of [1200, 1800, 2400]) { const o = osc(ac, 'sine', f, t, .8); o.frequency.linearRampToValueAtTime(f * 1.3, t + .6); env(ac, o, t, .04, .05, .7, out); } },
    thud(ac, t, out, nb) { const o = osc(ac, 'sine', 90, t, .5); o.frequency.exponentialRampToValueAtTime(40, t + .4); env(ac, o, t, .8, .002, .45, out); const n = noise(ac, t, .3, nb); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400; n.connect(fl); env(ac, fl, t, .4, .002, .25, out); },
    horn(ac, t, out) { for (const f of [98, 147, 196]) { const o = osc(ac, 'sawtooth', f, t, 1.4); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(1100, t + .3); o.connect(fl); env(ac, fl, t, .07, .15, 1.2, out); } },
    roar(ac, t, out, nb) { const n = noise(ac, t, 1.6, nb); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(250, t + 1.4); n.connect(fl); const tr = ac.createGain(); const lfo = osc(ac, 'sine', 24, t, 1.6); const lg = ac.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(tr.gain); fl.connect(tr); env(ac, tr, t, 1.1, .08, 1.4, out);
      const o = osc(ac, 'sawtooth', 70, t, 1.5); o.frequency.exponentialRampToValueAtTime(45, t + 1.3); const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 300; o.connect(f2); env(ac, f2, t, .5, .1, 1.3, out); },
    radio(ac, t, out, nb) { const n = noise(ac, t, .5, nb); const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1800; fl.Q.value = 6; n.connect(fl); env(ac, fl, t, .25, .01, .45, out); },
    click(ac, t, out, nb) { const n = noise(ac, t, .03, nb); const fl = ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 3000; n.connect(fl); env(ac, fl, t, .4, .001, .02, out); },
    tick(ac, t, out) { const o = osc(ac, 'square', 2000, t, .03); env(ac, o, t, .12, .001, .025, out); },
    punch() {}, sticker() {}, flash() {},
  };
  // ---------- музыка: жанры под темп и тему ----------
  const GENRES = {phonk:'Фонк', funk:'Бразильский фонк', trap:'Трэп', dnb:'Драм-н-бейс', house:'Хаус', jersey:'Джерси-клаб', synth:'Синтвейв', rock:'Рок', epic:'Эпик', chip:'8-бит', horror:'Хоррор', lofi:'Lo-fi', amb:'Эмбиент'};
  const BPM = {phonk:[128,140], funk:[128,134], trap:[136,150], dnb:[170,176], house:[122,126], jersey:[138,142], synth:[100,112], rock:[150,170], epic:[86,98], chip:[132,150], horror:[68,78], lofi:[76,88], amb:[70,80]};
  function autoGenre(set, r) {
    let pool = {1:['lofi','epic','horror','synth','amb'], 2:['phonk','funk','trap','chip','house','synth','rock'], 3:['dnb','phonk','funk','jersey','rock','trap']}[set.tempo].slice();
    if (set.theme === 'hard' || set.theme === 'dare') pool.push('horror', 'phonk', 'trap');
    if (set.theme === 'meme') pool.push('chip', 'phonk', 'chip');
    if (set.theme === 'wipe') pool.push('epic', 'dnb');
    if (set.theme === 'clan') pool.push('epic', 'trap');
    if (set.theme === 'meme') pool.push('funk', 'jersey'); if (set.theme === 'hard') pool.push('rock');
    if (set.tempo === 1) pool = pool.filter((g0) => !['dnb','jersey','rock','funk'].includes(g0)); if (set.tempo === 3) pool = pool.filter((g0) => !['lofi','horror','amb'].includes(g0));
    return pick(r, pool);
  }
  function inst(ac, out, nb) {
    const I = {
      kick(t, v = .9, f0 = 150) { const o = osc(ac, 'sine', f0, t, .45); o.frequency.exponentialRampToValueAtTime(42, t + .32); env(ac, o, t, v, .002, .4, out); },
      snare(t, v = .45, f = 1800, d = .16) { const n = noise(ac, t, d + .05, nb); const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = .8; n.connect(fl); env(ac, fl, t, v, .002, d, out); const o = osc(ac, 'triangle', 190, t, .1); env(ac, o, t, v * .4, .002, .08, out); },
      hat(t, v = .1, open = false) { const n = noise(ac, t, open ? .25 : .05, nb); const fl = ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7500; n.connect(fl); env(ac, fl, t, v, .001, open ? .22 : .035, out); },
      bass(t, f, len, v = .38, glide) { const o = osc(ac, 'sine', f, t, len); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + len * .6); const sh = ac.createWaveShaper(); const c = new Float32Array(128); for (let i = 0; i < 128; i++) { const x = i / 64 - 1; c[i] = Math.tanh(x * 2); } sh.curve = c; o.connect(sh); env(ac, sh, t, v, .01, len, out); },
      reese(t, f, len, v = .16) { for (const d of [-7, 7]) { const o = osc(ac, 'sawtooth', f, t, len); o.detune.value = d * 2; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420; o.connect(fl); env(ac, fl, t, v, .03, len, out); } },
      pad(t, fs, len, v = .05, cut = 1400) { for (const f of fs) for (const d of [-9, 9]) { const o = osc(ac, 'sawtooth', f, t, len + .3); o.detune.value = d; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; o.connect(fl); const gn = ac.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.linearRampToValueAtTime(v, t + len * .3); gn.gain.linearRampToValueAtTime(.0001, t + len + .3); fl.connect(gn); gn.connect(out); } },
      cowbell(t, f, v = .07) { for (const m of [1, 1.48]) { const o = osc(ac, 'square', f * m, t, .22); const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1100; fl.Q.value = 2; o.connect(fl); env(ac, fl, t, v, .002, .2, out); } },
      sq(t, f, len, v = .05, type = 'square') { const o = osc(ac, type, f, t, len); env(ac, o, t, v, .003, len, out); },
      pluck(t, f, v = .12) { const o = osc(ac, 'triangle', f, t, .5); const o2 = osc(ac, 'sine', f * 2, t, .3); env(ac, o, t, v, .003, .45, out); env(ac, o2, t, v * .4, .003, .25, out); },
      ep(t, fs, len, v = .07) { for (const f of fs) { const o = osc(ac, 'sine', f, t, len); const o2 = osc(ac, 'triangle', f * 2, t, len * .5); env(ac, o, t, v, .01, len, out); env(ac, o2, t, v * .25, .005, len * .5, out); } },
      taiko(t, v = .8) { const o = osc(ac, 'sine', 110, t, .6); o.frequency.exponentialRampToValueAtTime(48, t + .5); env(ac, o, t, v, .003, .55, out); const n = noise(ac, t, .12, nb); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 600; n.connect(fl); env(ac, fl, t, v * .5, .002, .1, out); },
      brass(t, fs, len, v = .06) { for (const f of fs) { const o = osc(ac, 'sawtooth', f, t, len); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, t); fl.frequency.linearRampToValueAtTime(2200, t + .08); fl.frequency.linearRampToValueAtTime(900, t + len); o.connect(fl); env(ac, fl, t, v, .02, len, out); } },
      crash(t, v = .25) { const n = noise(ac, t, 2, nb); const fl = ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 4000; n.connect(fl); env(ac, fl, t, v, .003, 1.8, out); },
      drone(t, f, len, v = .12) { for (const d of [-12, 0, 13]) { const o = osc(ac, 'sawtooth', f, t, len); o.detune.value = d; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 260; o.connect(fl); const gn = ac.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.linearRampToValueAtTime(v, t + 1.5); gn.gain.setValueAtTime(v, t + len - .5); gn.gain.linearRampToValueAtTime(.0001, t + len); fl.connect(gn); gn.connect(out); } },
      crackle(t, len) { for (let i = 0; i < len * 14; i++) { const tt = t + Math.random() * len; const n = noise(ac, tt, .01, nb); const fl = ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 3000; n.connect(fl); env(ac, fl, tt, .05 + Math.random() * .05, .001, .008, out); } },
    };
    return I;
  }
  const NOTE = (root, semi) => root * Math.pow(2, semi / 12);
  function music(ac, tl, out, nb) {
    const r = rng(tl.seed ^ 0xabcdef), G = tl.genre, [b0, b1] = BPM[G], bpm = b0 + Math.floor(r() * (b1 - b0 + 1)), beat = 60 / bpm, st = beat / 4, dur = tl.dur + .5;
    const I = inst(ac, out, nb), root = 41.2 * Math.pow(2, Math.floor(r() * 7) / 12);   // E1..A#1
    const minor = [0, 3, 7], prog = pick(r, [[0, 8, 3, 10], [0, 5, 8, 7], [0, 10, 8, 7], [0, 3, 8, 5]]);
    const scale = [0, 3, 5, 7, 10, 12, 15], mel = Array.from({length:16}, () => r() < .55 ? pick(r, scale) : null);
    const kickPats = {phonk:[[0,3,6,10],[0,4,8,12],[0,3,8,11,14]], funk:[[0,3,6,8,11,14],[0,3,7,10,12]], trap:[[0,7,10],[0,6,11],[0,3,10]], dnb:[[0,10],[0,7,10]], lofi:[[0,7,10],[0,8,11]], chip:[[0,8],[0,6,8,14]],
      house:[[0,4,8,12]], jersey:[[0,3,6,8,11,14],[0,4,7,10,12,14]], synth:[[0,8],[0,6,8]], rock:[[0,6,8,10],[0,3,8,11]]};
    const kp = kickPats[G] ? pick(r, kickPats[G]) : [];
    for (let bar = 0, t0 = .05; t0 < dur; bar++, t0 += st * 16) {
      const chordRoot = NOTE(root, prog[bar % 4]);
      if (G === 'trap') I.pad(t0, minor.map((x) => NOTE(chordRoot * 4, x)), st * 16, .035, 900);
      if (G === 'dnb') { I.pad(t0, minor.map((x) => NOTE(chordRoot * 4, x)), st * 16, .03, 1600); I.reese(t0, chordRoot, st * 16); }
      if (G === 'epic') { I.pad(t0, [0, 7, 12, 15].map((x) => NOTE(chordRoot * 2, x)), st * 16, .045, 1200); if (bar % 2 === 0) I.brass(t0, minor.map((x) => NOTE(chordRoot * 4, x)), st * 6); if (bar % 4 === 0) I.crash(t0, .15); }
      if (G === 'lofi') { I.ep(t0, [0, 3, 7, 10].map((x) => NOTE(chordRoot * 4, x)), st * 15, .05); I.crackle(t0, st * 16); }
      if (G === 'horror') { if (bar % 2 === 0) I.drone(t0, root, st * 32 + .5); }
      if (G === 'synth') I.pad(t0, [0, 3, 7, 10].map((x) => NOTE(chordRoot * 4, x)), st * 16, .04, 2200);
      if (G === 'amb') { if (bar % 2 === 0) I.pad(t0, [0, 7, 12, 15, 19].map((x) => NOTE(chordRoot * 2, x)), st * 32, .04, 900); }
      if (G === 'house' && bar % 2 === 0) I.pad(t0, minor.map((x) => NOTE(chordRoot * 4, x)), st * 32, .025, 1600);
      for (let s = 0; s < 16; s++) { const t = t0 + s * st + (G === 'lofi' && s % 2 ? st * .18 : 0); if (t > dur) break;
        if (kp.includes(s)) I.kick(t, G === 'lofi' ? .6 : .9);
        if (G === 'phonk') { if (kp.includes(s)) I.bass(t, chordRoot, st * 5, .34, s > 8 ? chordRoot * 1.19 : null); if (s === 4 || s === 12) I.snare(t); I.hat(t, s % 4 === 2 ? .16 : .08);
          const n = mel[s]; if (n !== null && bar % 4 !== 3) I.cowbell(t, NOTE(root * 8, n)); }
        if (G === 'trap') { if (kp.includes(s)) I.bass(t, chordRoot, st * 7, .4, r() < .3 ? chordRoot * .75 : null); if (s === 8) I.snare(t, .5, 2000, .2);
          if (r() < .18 && s % 4 === 3) { for (let k = 0; k < 3; k++) I.hat(t + k * st / 3, .09); } else I.hat(t, s % 2 ? .06 : .1); }
        if (G === 'dnb') { if (s === 4 || s === 12) I.snare(t, .5, 1900, .14); if ((s === 7 || s === 14) && r() < .5) I.snare(t, .15); if (s % 2 === 0) I.hat(t, s % 4 === 2 ? .14 : .08); }
        if (G === 'lofi') { if (s === 4 || s === 12) I.snare(t, .25, 1200, .12); if (s % 2 === 0) I.hat(t, .05); }
        if (G === 'chip') { if (kp.includes(s)) I.kick(t, .7, 120); if (s === 4 || s === 12) I.snare(t, .3, 3000, .08);
          I.sq(t, NOTE(chordRoot * 8, minor[s % 3] + (s % 6 > 2 ? 12 : 0)), st * .9, .035); if (s % 2 === 0) I.sq(t, chordRoot * 2, st * 1.8, .06, 'triangle'); }
        if (G === 'epic') { if ([0, 6, 8, 11, 14].includes(s) && (s === 0 || r() < .7)) I.taiko(t, s === 0 ? .9 : .55); }
        if (G === 'horror') { if (s === 0 || s === 2) I.kick(t, s ? .5 : .75, 90); if (r() < .06) I.pluck(t, NOTE(root * 16, pick(r, [0, 1, 6, 11, 13])), .07); }
        if (G === 'funk') { if (kp.includes(s)) I.bass(t, chordRoot * (s % 8 > 4 ? 1.5 : 1), st * 2.2, .45, chordRoot * .8); if (s === 4 || s === 12 || (s === 14 && r() < .5)) I.snare(t, .4, 2400, .1); I.hat(t, s % 2 ? .05 : .11);
          const n = mel[s]; if (n !== null && s % 2 === 0) I.cowbell(t, NOTE(root * 16, n) * (r() < .2 ? 1.06 : 1), .06); }
        if (G === 'house') { if (kp.includes(s)) I.kick(t, .85); if (s % 4 === 2) I.hat(t, .14, true); if (s === 4 || s === 12) I.snare(t, .25, 1500, .12); if ([2, 7, 10].includes(s)) I.ep(t, minor.map((x) => NOTE(chordRoot * 4, x)), st * 1.5, .04); }
        if (G === 'jersey') { if (kp.includes(s)) I.kick(t, .85, 160); if (s === 4 || s === 12) I.snare(t, .35, 2200, .1); I.hat(t, .07); if (s === 13 && r() < .7) I.sq(t, NOTE(root * 32, 7), st * .6, .04, 'sine'); }
        if (G === 'synth') { if (kp.includes(s)) I.kick(t, .8); if (s === 4 || s === 12) I.snare(t, .45, 1500, .25); if (s % 2 === 0) I.hat(t, .07); I.sq(t, NOTE(chordRoot * 8, [0, 7, 12, 15][s % 4]), st * .9, .03, 'sawtooth'); if (s % 4 === 0) I.bass(t, chordRoot, st * 3.5, .3); }
        if (G === 'rock') { if (kp.includes(s)) I.kick(t, .9); if (s === 4 || s === 12) I.snare(t, .55, 1700, .18); if (s % 2 === 0) { I.hat(t, .1); I.brass(t, [chordRoot * 2, chordRoot * 3], st * 1.8, .05); } if (s === 0 && bar % 4 === 0) I.crash(t, .2); }
        if (G === 'amb') { if (r() < .08) I.pluck(t, NOTE(root * 8, pick(r, scale)), .05); }
      }
    }
    return bpm;
  }
  async function mixAudio(tl, voices, track) {
    const SR = 48000, ac = new OfflineAudioContext(2, Math.ceil(tl.dur * SR), SR), set = tl.set, nb = noiseBuf(ac, 2.5);
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 6; lim.attack.value = .002; lim.release.value = .15; lim.connect(ac.destination);
    const master = ac.createGain(); master.gain.value = 1.6; master.connect(lim);
    const vBus = ac.createGain(); vBus.gain.value = 1.6; vBus.connect(master);
    const mOut = ac.createGain(); mOut.connect(master);
    const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.Q.value = .7; lpf.frequency.value = 18000; lpf.connect(mOut);
    const mBus = ac.createGain(); mBus.connect(lpf);
    const fBus = ac.createGain(); fBus.gain.value = .8; fBus.connect(master);
    const anyVoice = tl.items.some((x) => x.voiced), vol = (set.musicVol ?? 100) / 100, base = (anyVoice ? .3 : .62) * vol;
    mOut.gain.setValueAtTime(base, 0);
    // драматургия: вступление приглушено фильтром, «дроп» после хука, стоп на скретче, провал на драме, подъём перед финалом
    const items = tl.items, drop = items[1] ? items[1].start : 1;
    if (set.tempo > 1 && items.length > 2) { lpf.frequency.setValueAtTime(700, 0); lpf.frequency.exponentialRampToValueAtTime(18000, drop + .05); }
    const SFXI = inst(ac, fBus, nb);
    if (set.tempo > 1 && items.length > 2 && set.music !== 'none') SFXI.crash(drop, .2);
    for (const f of tl.fx) {
      if (f.type === 'record') { mOut.gain.setValueAtTime(base, f.t); mOut.gain.linearRampToValueAtTime(.0001, f.t + .08); mOut.gain.setValueAtTime(.0001, f.t + .55); mOut.gain.linearRampToValueAtTime(base, f.t + .7); }
      if (f.type === 'dramatic') { lpf.frequency.setValueAtTime(18000, f.t); lpf.frequency.exponentialRampToValueAtTime(320, f.t + .3); lpf.frequency.setValueAtTime(320, f.t + 1.8); lpf.frequency.exponentialRampToValueAtTime(18000, f.t + 2.1); }
    }
    const last = items[items.length - 1];
    if (items.length > 3 && set.tempo > 1) { const rs = noise(ac, last.start - 1.4, 1.4, nb); const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(400, last.start - 1.4); fl.frequency.exponentialRampToValueAtTime(6000, last.start); rs.connect(fl); const gn = ac.createGain(); gn.gain.setValueAtTime(.0001, last.start - 1.4); gn.gain.exponentialRampToValueAtTime(.3, last.start - .02); gn.gain.linearRampToValueAtTime(.0001, last.start); fl.connect(gn); gn.connect(fBus); }
    let vIn = vBus;
    if (set.vfx === 'demon') { const lp2 = ac.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 2400; const sh = ac.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 1.8); } sh.curve = c; lp2.connect(sh); sh.connect(vBus); vIn = lp2; }
    if (set.vfx === 'radio') { const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; const lp2 = ac.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 3000; const sh = ac.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); } sh.curve = c; hp.connect(lp2); lp2.connect(sh); sh.connect(vBus); vIn = hp; }
    if (set.vfx === 'echo') { const dry = ac.createGain(); dry.connect(vBus); const dl = ac.createDelay(1); dl.delayTime.value = .16; const fb = ac.createGain(); fb.gain.value = .12; const lp2 = ac.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1800; dry.connect(dl); dl.connect(lp2); lp2.connect(fb); fb.connect(dl); const wet = ac.createGain(); wet.gain.value = .22; lp2.connect(wet); wet.connect(vBus); vIn = dry; }
    if (set.voice !== false) for (const it of items) { if (!it.voiced) continue; const b = voices[it.id]; if (!b) continue; const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = vrate(set); s.connect(vIn); s.start(it.voiceAt);
      mBus.gain.setTargetAtTime(.55, it.voiceAt, .05); mBus.gain.setTargetAtTime(1, it.voiceAt + it.vd, .1); }
    let bpm = 0;
    if (set.music === 'custom' && track) { const s = ac.createBufferSource(); s.buffer = track; s.loop = track.duration < tl.dur; s.connect(mBus); s.start(0, Math.min(set.trackStart || 0, Math.max(0, track.duration - 1))); }
    else if (set.music !== 'none' && set.music !== 'custom') bpm = music(ac, tl, mBus, nb);
    const hum = ac.createBufferSource(); hum.buffer = nb; hum.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; hum.connect(lp); const hg = ac.createGain(); hg.gain.value = .035; lp.connect(hg); hg.connect(master); hum.start(0);
    for (const s of tl.sfx) if (SFX[s.type] && s.t >= 0) SFX[s.type](ac, s.t, fBus, nb);
    tl.bpm = bpm;
    return ac.startRendering();
  }

  // ---------- описание ----------
  const TAGS = {wipe:'#вайп #новыйсезон', server:'#сервермайнкрафт #механики', meme:'#мем #юмор #смешно', hard:'#хардкор #выживание', clan:'#клан #пати #друзья', dare:'#челлендж #вызов', mix:'#рекомендации'};
  function description(tl, code) {
    const hook = byId[tl.items[0].id].say;
    const facts = tl.items.slice(1).filter((x) => byId[x.id].role === 'body').slice(0, 2).map((x) => byId[x.id].say);
    return `${hook}\n${facts.join(' ')}${facts.length ? '\n' : ''}Вайп 4 декабря, 18:00 по Киеву (19:00 МСК).\n\nIP: evilverse.lol${code ? '\nПромокод: ' + code : ''}\n\n${pick(rng(tl.seed), ['А ты бы рискнул? 👇', 'Сколько ты продержишься? 👇', 'Отметь друга, который умрёт первым 👇', 'Пиши в комменты, что добавить 👇'])}\n#evilverse #minecraft #майнкрафт #minecraftserver ${TAGS[tl.set.theme] || ''}`;
  }

  return {get BANK() { return ALL; }, byId, THEMES, TEMPO, GENRES, FORMATS, BGS, MASCOTS, makeScript, reroll, build, renderFrame, mixAudio, description, rng};
})();
