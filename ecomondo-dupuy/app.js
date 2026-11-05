(function () {
  const D = window.ECOMONDO_DATA;
  const rows = D.items;
  const $ = (id) => document.getElementById(id);
  const FOCUS = new Set(D.focusSegments);

  document.getElementById('asof').textContent = D.asof;

  // KPI header
  const top = rows.filter((r) => r.score >= 4).length;
  const dm = rows.filter((r) => r.dm && r.dm.length).length;
  $('kpis').innerHTML =
    kpi(D.totalExhibitors, 'espositori totali') +
    kpi(rows.length, 'in linea con Dupuy') +
    kpi(top, 'priorità alta') +
    kpi(dm, 'con decision maker');
  function kpi(n, l) { return `<div class="kpi"><b>${n.toLocaleString('it-IT')}</b><span>${l}</span></div>`; }

  // populate filters
  fill('fSeg', Object.entries(D.segments).map(([k, v]) => [k, v]));
  fill('fRole', [...new Set(rows.map((r) => r.ruolo))].sort().map((x) => [x, x]));
  const cc = {};
  rows.forEach((r) => { if (r.country) cc[r.country] = (cc[r.country] || 0) + 1; });
  fill('fCountry', Object.entries(cc).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, `${k} (${n})`]));
  function fill(id, opts) {
    const s = $(id);
    opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; s.appendChild(o); });
  }

  // restore state
  const KEY = 'ecomondo-dupuy-filters';
  try {
    const st = JSON.parse(localStorage.getItem(KEY) || '{}');
    ['q', 'fSeg', 'fRole', 'fScore', 'fCountry', 'fSort'].forEach((k) => { if (st[k] != null) $(k).value = st[k]; });
    ['fFocus', 'fDm'].forEach((k) => { if (st[k] != null) $(k).checked = st[k]; });
  } catch (e) { /* ignore */ }

  const tpl = $('tpl');
  const list = $('list');
  let current = [];

  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  rows.forEach((r) => {
    r._hay = norm([r.name, r.perche, r.city, r.country, r.desc, (r.cats || []).join(' '), (r.dm || []).map((p) => p.name + ' ' + p.role).join(' ')].join(' '));
  });

  function apply() {
    const q = norm($('q').value.trim());
    const seg = $('fSeg').value, role = $('fRole').value, min = +$('fScore').value, country = $('fCountry').value;
    const focus = $('fFocus').checked, wantDm = $('fDm').checked, sort = $('fSort').value;
    try { localStorage.setItem(KEY, JSON.stringify({ q: $('q').value, fSeg: seg, fRole: role, fScore: min, fCountry: country, fSort: sort, fFocus: focus, fDm: wantDm })); } catch (e) { /* ignore */ }
    const terms = q.split(/\s+/).filter(Boolean);
    current = rows.filter((r) =>
      r.score >= min &&
      (!seg || r.segs.includes(seg)) &&
      (!role || r.ruolo === role) &&
      (!country || r.country === country) &&
      (!focus || r.segs.some((s) => FOCUS.has(s))) &&
      (!wantDm || (r.dm && r.dm.length)) &&
      terms.every((t) => r._hay.includes(t))
    );
    current.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name)
      : sort === 'pos' ? (a, b) => (a.pos || 'zz').localeCompare(b.pos || 'zz')
      : (a, b) => b.score - a.score || (b.dm ? b.dm.length : 0) - (a.dm ? a.dm.length : 0) || a.name.localeCompare(b.name));
    render();
  }

  function li(q) { return 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(q); }

  function render() {
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
        : `<a class="btn primary disabled" aria-disabled="true">Sito n.d.</a>`);
      if (r.linkedin) act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr(r.linkedin)}" target="_blank" rel="noopener">LinkedIn azienda</a>`);
      else act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr('https://www.linkedin.com/search/results/companies/?keywords=' + encodeURIComponent(short))}" target="_blank" rel="noopener">Cerca su LinkedIn</a>`);
      if (r.link) act.insertAdjacentHTML('beforeend', `<a class="btn ghost" href="${attr(r.link)}" target="_blank" rel="noopener">Scheda Ecomondo</a>`);
      frag.appendChild(n);
    });
    list.appendChild(frag);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function attr(u) { const s = String(u || ''); return /^https?:\/\//i.test(s) ? esc(s) : '#'; }

  $('csv').addEventListener('click', () => {
    const head = ['Azienda', 'Priorità', 'Ruolo', 'Segmenti', 'Perché Dupuy', 'Paese', 'Città', 'Stand', 'Sito', 'Telefono', 'Email', 'LinkedIn azienda', 'Decision maker', 'Scheda Ecomondo'];
    const lines = [head].concat(current.map((r) => [
      r.name, r.score, r.ruolo, r.segs.map((s) => D.segments[s]).join(' | '), r.perche, r.country, r.city, r.pos, r.web, r.tel, r.email, r.linkedin,
      (r.dm || []).map((p) => `${p.name} (${p.role})${p.url ? ' ' + p.url : ''}`).join(' | '), r.link,
    ]));
    const csv = '﻿' + lines.map((l) => l.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ecomondo2026_lead_dupuy.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  let t;
  $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 150); });
  ['fSeg', 'fRole', 'fScore', 'fCountry', 'fSort', 'fFocus', 'fDm'].forEach((id) => $(id).addEventListener('change', apply));
  apply();
})();
