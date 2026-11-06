(function () {
  const D = window.ECOMONDO_DATA;
  const rows = D.items;
  const $ = (id) => document.getElementById(id);
  const FOCUS = new Set(D.focusSegments);

  // ---------- Pianta schematica (ridisegnata dalla planimetria ufficiale Ecomondo 2026) ----------
  const HALLS = [];
  (function buildGeometry() {
    const yTop = 30, hRow = 85, yCor = 117, hCor = 26, yBot = 145;
    // Ala Ovest: colonne da 7 a 1 (sinistra → destra)
    const west = [[7, 52], [6, 30], [5, 52], [4, 30], [3, 52], [2, 30], [1, 52]];
    let x = 60;
    west.forEach(([n, w]) => {
      HALLS.push({ id: 'C' + n, x, y: yTop, w, h: hRow });
      HALLS.push({ id: 'A' + n, x, y: yBot, w, h: hRow });
      if (n === 7 || n === 5) HALLS.push({ id: `Hall A${n}-C${n}`, label: '↕', x, y: yCor, w, h: hCor, small: true });
      x += w + 2;
    });
    HALLS.push({ id: 'Hall SUD', label: 'Hall Sud', x: x + 8, y: 60, w: 62, h: 140 });
    x += 8 + 62 + 10;
    const east = [[1, 52], [2, 28], [3, 52], [4, 28], [5, 52], [6, 28], [7, 52]];
    east.forEach(([n, w]) => {
      HALLS.push({ id: 'D' + n, x, y: yTop, w, h: hRow });
      HALLS.push({ id: 'B' + n, x, y: yBot, w, h: hRow });
      if (n === 7 || n === 5) HALLS.push({ id: `Hall B${n}-D${n}`, label: '↕', x, y: yCor, w, h: hCor, small: true });
      x += w + 2;
    });
    x += 16;
    HALLS.push({ id: 'D8', x, y: yTop, w: 34, h: hRow });
    HALLS.push({ id: 'B8', x, y: yBot, w: 34, h: hRow });
    HALLS.endX = x + 34;
  })();
  const ON_MAP = new Set(HALLS.map((h) => h.id));

  // Ordine di visita: ingresso Sud → Hall Sud → ala Ovest (A/C per colonna) → ala Est (B/D per colonna) → aree esterne
  const ORDER = ['Hall SUD'];
  for (let n = 1; n <= 7; n++) { ORDER.push('A' + n); if (n === 5 || n === 7) ORDER.push(`Hall A${n}-C${n}`); ORDER.push('C' + n); }
  ORDER.push('Piscine Ovest', 'Park OVEST');
  for (let n = 1; n <= 8; n++) { ORDER.push('B' + n); if (n === 5 || n === 7) ORDER.push(`Hall B${n}-D${n}`); ORDER.push('D' + n); }
  ORDER.push('Piscine Est', 'Esterno quartiere');
  const rank = (h) => { const i = ORDER.indexOf(h); return i < 0 ? 999 : i; };
  const hallName = (h) => (/^[ABCD]\d$/.test(h) ? 'Padiglione ' + h : h);

  $('asof').textContent = D.asof;

  // KPI
  const top = rows.filter((r) => r.score >= 4).length;
  const dm = rows.filter((r) => r.dm && r.dm.length).length;
  $('kpis').innerHTML = kpi(D.totalExhibitors, 'espositori totali') + kpi(rows.length, 'in linea con Dupuy') + kpi(top, 'priorità alta') + kpi(dm, 'con decision maker');
  function kpi(n, l) { return `<div class="kpi"><b>${n.toLocaleString('it-IT')}</b><span>${l}</span></div>`; }

  // Filtri
  fill('fSeg', Object.entries(D.segments));
  fill('fRole', [...new Set(rows.map((r) => r.ruolo))].sort().map((x) => [x, x]));
  const cc = {};
  rows.forEach((r) => { if (r.country) cc[r.country] = (cc[r.country] || 0) + 1; });
  fill('fCountry', Object.entries(cc).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, `${k} (${n})`]));
  const allHalls = [...new Set(rows.flatMap((r) => r.stands.map((s) => s.h)))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  fill('fHall', allHalls.map((h) => [h, hallName(h)]));
  function fill(id, opts) {
    const s = $(id);
    opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; s.appendChild(o); });
  }

  const IDS = ['q', 'fSeg', 'fRole', 'fScore', 'fCountry', 'fHall', 'fView'];
  const CHK = ['fFocus', 'fDm'];
  const KEY = 'ecomondo-dupuy-filters-v2';
  try {
    const st = JSON.parse(localStorage.getItem(KEY) || '{}');
    IDS.forEach((k) => { if (st[k] != null) $(k).value = st[k]; });
    CHK.forEach((k) => { if (st[k] != null) $(k).checked = st[k]; });
  } catch (e) { /* storage non disponibile */ }

  const tpl = $('tpl');
  const list = $('list');
  let current = [];

  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  rows.forEach((r) => {
    r._hay = norm([r.name, r.perche, r.city, r.country, r.pos, r.desc, (r.cats || []).join(' '), (r.dm || []).map((p) => p.name + ' ' + p.role).join(' ')].join(' '));
    r._halls = r.stands.map((s) => s.h);
  });

  function baseFilter(r, f, ignoreHall) {
    return r.score >= f.min &&
      (!f.seg || r.segs.includes(f.seg)) &&
      (!f.role || r.ruolo === f.role) &&
      (!f.country || r.country === f.country) &&
      (ignoreHall || !f.hall || r._halls.includes(f.hall)) &&
      (!f.focus || r.segs.some((s) => FOCUS.has(s))) &&
      (!f.wantDm || (r.dm && r.dm.length)) &&
      f.terms.every((t) => r._hay.includes(t));
  }

  function readFilters() {
    const f = {
      q: $('q').value, seg: $('fSeg').value, role: $('fRole').value, min: +$('fScore').value, country: $('fCountry').value,
      hall: $('fHall').value, view: $('fView').value, focus: $('fFocus').checked, wantDm: $('fDm').checked,
    };
    f.terms = norm(f.q.trim()).split(/\s+/).filter(Boolean);
    try {
      const st = {}; IDS.forEach((k) => { st[k] = $(k).value; }); CHK.forEach((k) => { st[k] = $(k).checked; });
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) { /* ignore */ }
    return f;
  }

  function apply() {
    const f = readFilters();
    current = rows.filter((r) => baseFilter(r, f, false));
    const forMap = rows.filter((r) => baseFilter(r, f, true));
    drawMap(forMap, f.hall);
    document.body.classList.toggle('view-route', f.view === 'route');
    if (f.view === 'route') renderRoute(f); else renderCards();
  }

  // ---------- Mappa ----------
  function drawMap(set, active) {
    const counts = {};
    set.forEach((r) => new Set(r._halls).forEach((h) => { counts[h] = (counts[h] || 0) + 1; }));
    const max = Math.max(1, ...HALLS.map((h) => counts[h.id] || 0));
    const svg = $('map');
    let s = '';
    s += `<rect class="m-ent" x="8" y="95" width="44" height="60" rx="3"/><text class="m-ent-t" x="30" y="128">Ingr. Ovest</text>`;
    s += `<rect class="m-cor" x="60" y="117" width="${HALLS.find((h) => h.id === 'C1').x + 52 - 60}" height="26"/>`;
    const d1 = HALLS.find((h) => h.id === 'D1'), d7 = HALLS.find((h) => h.id === 'D7');
    s += `<rect class="m-cor" x="${d1.x}" y="117" width="${d7.x + d7.w - d1.x}" height="26"/>`;
    const hs = HALLS.find((h) => h.id === 'Hall SUD');
    s += `<text class="m-ent-t" x="${hs.x + hs.w / 2}" y="222">▲ Ingr. Sud</text>`;
    s += `<text class="m-ent-t" x="${HALLS.endX - 17}" y="20">Ingr. Est ▸</text>`;
    HALLS.forEach((h) => {
      const n = counts[h.id] || 0;
      const t = n / max;
      const cls = ['m-hall', n ? 'has' : 'zero', active === h.id ? 'active' : '', h.small ? 'small' : ''].join(' ');
      const fill = n ? `fill:color-mix(in srgb, var(--red) ${Math.round(18 + t * 82)}%, var(--card))` : '';
      s += `<g class="${cls}" data-hall="${h.id}" tabindex="0" role="button" aria-label="${hallName(h.id)}: ${n} lead">`;
      s += `<title>${hallName(h.id)} — ${n} lead</title>`;
      s += `<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" rx="3" style="${fill}"/>`;
      if (h.small) {
        if (n) s += `<text class="m-n" x="${h.x + h.w / 2}" y="${h.y + h.h / 2 + 5}">${n}</text>`;
      } else {
        s += `<text class="m-l" x="${h.x + h.w / 2}" y="${h.y + h.h / 2 - 6}">${h.label || h.id}</text>`;
        s += `<text class="m-n" x="${h.x + h.w / 2}" y="${h.y + h.h / 2 + 16}">${n || ''}</text>`;
      }
      s += '</g>';
    });
    svg.setAttribute('viewBox', `0 0 ${HALLS.endX + 8} 235`);
    svg.innerHTML = s;
    // aree non disegnate in pianta
    const extra = Object.keys(counts).filter((h) => !ON_MAP.has(h)).sort((a, b) => rank(a) - rank(b));
    $('mapExtra').innerHTML = extra.length
      ? 'Altre aree: ' + extra.map((h) => `<button type="button" class="chip-hall${active === h ? ' active' : ''}" data-hall="${esc(h)}">${esc(h)} · ${counts[h]}</button>`).join(' ')
      : '';
  }
  function toggleHall(h) {
    $('fHall').value = $('fHall').value === h ? '' : h;
    apply();
    if ($('fHall').value) $('list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('map').addEventListener('click', (e) => { const g = e.target.closest('[data-hall]'); if (g) toggleHall(g.dataset.hall); });
  $('map').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('[data-hall]'); if (g) { e.preventDefault(); toggleHall(g.dataset.hall); }
  });
  $('mapExtra').addEventListener('click', (e) => { const b = e.target.closest('[data-hall]'); if (b) toggleHall(b.dataset.hall); });

  // ---------- Vista percorso ----------
  function standNum(n) { const m = String(n).match(/\d+/); return m ? +m[0] : 9999; }
  function renderRoute(f) {
    const groups = {};
    current.forEach((r) => r.stands.forEach((s) => {
      if (f.hall && s.h !== f.hall) return;
      (groups[s.h] = groups[s.h] || []).push({ r, s });
    }));
    const noStand = current.filter((r) => !r.stands.length);
    const halls = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const stops = halls.reduce((n, h) => n + groups[h].length, 0);
    $('count').textContent = `${current.length} aziende · ${stops} stand in ${halls.length} aree, in ordine di visita (ingresso Sud → Hall Sud → ala Ovest → ala Est)`;
    if (!halls.length && !noStand.length) { list.innerHTML = '<div class="empty">Nessuna azienda con questi filtri.</div>'; return; }
    let h = '';
    let step = 0;
    halls.forEach((hall) => {
      const g = groups[hall].sort((a, b) => standNum(a.s.n) - standNum(b.s.n) || b.r.score - a.r.score);
      h += `<section class="hall-block"><h3><span class="hall-badge">${esc(hall)}</span> ${esc(hallName(hall))} <small>${g.length} stand</small></h3><ol class="route" start="${step + 1}">`;
      g.forEach(({ r, s }) => {
        step++;
        const other = r.stands.filter((x) => x.s !== s.s).map((x) => x.s);
        h += `<li class="stop${r.score >= 5 ? ' top5' : ''}">
          <div class="stop-stand">${esc(s.n || '—')}</div>
          <div class="stop-main">
            <div class="stop-name">${esc(r.name)} <span class="score-s">${'★'.repeat(r.score)}</span></div>
            <div class="stop-meta">${esc(r.ruolo)}${r.city || r.country ? ' · ' + esc([r.city, r.country].filter(Boolean).join(', ')) : ''}${other.length ? ' · anche in ' + esc(other.join(', ')) : ''}</div>
            <div class="stop-why">${esc(r.perche)}</div>
            ${dmBlock(r)}
          </div>
          <div class="stop-act">
            ${r.web ? `<a class="btn primary sm" href="${attr(r.web)}" target="_blank" rel="noopener">Sito ↗</a>` : ''}
            ${s.map ? `<a class="btn ghost sm" href="${attr(s.map)}" target="_blank" rel="noopener">📍 Mappa</a>` : ''}
            <a class="btn ghost sm" href="${attr(r.linkedin || 'https://www.linkedin.com/search/results/companies/?keywords=' + encodeURIComponent(r.short || r.name))}" target="_blank" rel="noopener">in</a>
          </div>
        </li>`;
      });
      h += '</ol></section>';
    });
    if (noStand.length && !f.hall) {
      h += `<section class="hall-block"><h3><span class="hall-badge">?</span> Senza stand indicato <small>${noStand.length}</small></h3><ul class="route">` +
        noStand.map((r) => `<li class="stop"><div class="stop-stand">—</div><div class="stop-main"><div class="stop-name">${esc(r.name)} <span class="score-s">${'★'.repeat(r.score)}</span></div><div class="stop-why">${esc(r.perche)}</div></div><div class="stop-act">${r.web ? `<a class="btn primary sm" href="${attr(r.web)}" target="_blank" rel="noopener">Sito ↗</a>` : ''}</div></li>`).join('') +
        '</ul></section>';
    }
    list.innerHTML = h;
  }

  function dmBlock(r) {
    const short = r.short || r.name;
    if (r.dm && r.dm.length) {
      return '<div class="stop-dm"><span class="dm-lbl">Decision maker</span><ul>' + r.dm.map((p) =>
        `<li><a href="${attr(p.url || li(p.name + ' ' + short))}" target="_blank" rel="noopener" title="Apri su LinkedIn"><b>${esc(p.name)}</b></a> — ${esc(p.role)}${p.src ? ` <a class="src" href="${attr(p.src)}" target="_blank" rel="noopener">[fonte]</a>` : ''}</li>`
      ).join('') + '</ul></div>';
    }
    return `<div class="stop-dm none"><span class="dm-lbl">Decision maker</span> da individuare · cerca su LinkedIn: ` +
      D.dmRoles.slice(0, 3).map(([lbl, kw]) => `<a href="${attr(li(short + ' ' + kw))}" target="_blank" rel="noopener">${esc(lbl)}</a>`).join(' · ') + '</div>';
  }

  // ---------- Vista schede ----------
  function li(q) { return 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(q); }
  function renderCards() {
    current.sort((a, b) => b.score - a.score || (b.dm ? b.dm.length : 0) - (a.dm ? a.dm.length : 0) || a.name.localeCompare(b.name));
    $('count').textContent = `${current.length} aziende mostrate su ${rows.length}`;
    list.innerHTML = '';
    if (!current.length) { list.innerHTML = '<div class="empty">Nessuna azienda con questi filtri.</div>'; return; }
    const frag = document.createDocumentFragment();
    current.forEach((r) => {
      const n = tpl.content.firstElementChild.cloneNode(true);
      if (r.score >= 5) n.classList.add('top5');
      n.querySelector('.name').textContent = r.name;
      n.querySelector('.meta').textContent = [r.city, r.country, r.pos ? 'Stand ' + r.pos : ''].filter(Boolean).join(' · ');
      n.querySelector('.score').innerHTML = '★'.repeat(r.score) + `<span class="off">${'★'.repeat(5 - r.score)}</span>`;
      const tags = n.querySelector('.tags');
      tags.insertAdjacentHTML('beforeend', `<span class="tag role">${esc(r.ruolo)}</span>`);
      r.segs.forEach((s) => tags.insertAdjacentHTML('beforeend', `<span class="tag">${esc(D.segments[s] || s)}</span>`));
      n.querySelector('.why').textContent = r.perche;

      const dmEl = n.querySelector('.dm');
      let h = '<b>Decision maker</b>';
      if (r.dm && r.dm.length) {
        h += '<ul>' + r.dm.map((p) => {
          const href = p.url || li(p.name + ' ' + r.name);
          const src = p.src ? ` <a class="src" href="${attr(p.src)}" target="_blank" rel="noopener">[fonte]</a>` : '';
          return `<li><a href="${attr(href)}" target="_blank" rel="noopener" title="Cerca su LinkedIn">${esc(p.name)}</a> — ${esc(p.role)}${src}</li>`;
        }).join('') + '</ul><div class="src">Nome → ricerca LinkedIn. Da fonti web pubbliche, anche aggregatori: verificare prima del contatto.</div>';
      } else {
        h += ' <span class="src">— nessun nominativo verificato: usa le ricerche LinkedIn qui sotto.</span>';
      }
      const short = r.short || r.name;
      h += '<div class="search">' + D.dmRoles.map(([lbl, kw]) => `<a href="${attr(li(short + ' ' + kw))}" target="_blank" rel="noopener">🔎 ${esc(lbl)}</a>`).join('') + '</div>';
      dmEl.innerHTML = h;

      const act = n.querySelector('.actions');
      act.insertAdjacentHTML('beforeend', r.web
        ? `<a class="btn primary" href="${attr(r.web)}" target="_blank" rel="noopener">Visita sito ↗</a>`
        : '<a class="btn primary disabled" aria-disabled="true">Sito n.d.</a>');
      r.stands.filter((s) => s.map).forEach((s) => act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr(s.map)}" target="_blank" rel="noopener">📍 ${esc(s.s)}</a>`));
      if (r.linkedin) act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr(r.linkedin)}" target="_blank" rel="noopener">LinkedIn azienda</a>`);
      else act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr('https://www.linkedin.com/search/results/companies/?keywords=' + encodeURIComponent(short))}" target="_blank" rel="noopener">Cerca su LinkedIn</a>`);
      if (r.link) act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr(r.link)}" target="_blank" rel="noopener">Scheda Ecomondo</a>`);
      frag.appendChild(n);
    });
    list.appendChild(frag);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function attr(u) { const s = String(u || ''); return /^https?:\/\//i.test(s) ? esc(s) : '#'; }

  // ---------- Export ----------
  $('csv').addEventListener('click', () => {
    const head = ['Ordine', 'Padiglione', 'Stand', 'Azienda', 'Priorità', 'Ruolo', 'Segmenti', 'Perché Dupuy', 'Paese', 'Città', 'Sito', 'Telefono', 'Email', 'LinkedIn azienda', 'Decision maker', 'Mappa stand', 'Scheda Ecomondo'];
    const out = [];
    current.forEach((r) => {
      const st = r.stands.length ? r.stands : [{ h: '', n: '', map: '' }];
      st.forEach((s) => out.push({ r, s }));
    });
    out.sort((a, b) => rank(a.s.h) - rank(b.s.h) || standNum(a.s.n) - standNum(b.s.n));
    const lines = [head].concat(out.map(({ r, s }, i) => [
      i + 1, s.h, s.n, r.name, r.score, r.ruolo, r.segs.map((x) => D.segments[x]).join(' | '), r.perche, r.country, r.city, r.web, r.tel, r.email, r.linkedin,
      (r.dm || []).map((p) => `${p.name} (${p.role})`).join(' | '), s.map, r.link,
    ]));
    const csv = '﻿' + lines.map((l) => l.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ecomondo2026_lead_dupuy_per_padiglione.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('print').addEventListener('click', () => {
    if ($('fView').value !== 'route') { $('fView').value = 'route'; apply(); }
    window.print();
  });

  let t;
  $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 150); });
  ['fSeg', 'fRole', 'fScore', 'fCountry', 'fHall', 'fView', 'fFocus', 'fDm'].forEach((id) => $(id).addEventListener('change', apply));
  apply();
})();
