// ── Helpers ───────────────────────────────────────────────────────────
function todayMidnight() {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function fmtDate(str) {
    if (!str) return '—';
    return new Date(str + 'T00:00:00').toLocaleDateString('he-IL', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}
function fmtDateShort(str) {
    if (!str) return '—';
    return new Date(str + 'T00:00:00').toLocaleDateString('he-IL');
}
function daysUntil(str) {
    const t = todayMidnight();
    const d = new Date(str + 'T00:00:00'); d.setHours(0,0,0,0);
    return Math.ceil((d - t) / 86400000);
}

// ── Categorize ────────────────────────────────────────────────────────
function categorize(v) {
    const today  = todayMidnight();
    const given  = new Date(v.date_given + 'T00:00:00'); given.setHours(0,0,0,0);
    const expiry = v.expiry_date ? new Date(v.expiry_date + 'T00:00:00') : null;
    if (expiry) expiry.setHours(0,0,0,0);
    if (given > today) return 'future';
    if (expiry && expiry >= today) return 'active';
    return 'done';
}

// ── Progress bar HTML (active vaccines) ──────────────────────────────
function buildProgressBar(v) {
    const today   = todayMidnight();
    const given   = new Date(v.date_given   + 'T00:00:00'); given.setHours(0,0,0,0);
    const expiry  = new Date(v.expiry_date  + 'T00:00:00'); expiry.setHours(0,0,0,0);
    const total   = Math.max(1, Math.ceil((expiry - given)  / 86400000));
    const elapsed = Math.ceil((today - given)  / 86400000);
    const remain  = Math.ceil((expiry - today) / 86400000);
    const pct     = Math.min(100, Math.max(0, Math.round(elapsed / total * 100)));
    const color   = pct < 60 ? '#2a9d8f' : pct < 85 ? '#f4a261' : '#e74c3c';
    const remainColor = remain <= 15 ? '#e74c3c' : remain <= 30 ? '#f4a261' : '#888';

    return `
        <div class="vax-progress-wrap">
            <div class="vax-progress-labels">
                <span>${elapsed} ימים מאז המנה</span>
                <span style="color:${remainColor}; font-weight:600;">
                    ${remain > 0 ? 'פג תוקף בעוד ' + remain + ' ימים' : 'פג תוקף!'}
                </span>
            </div>
            <div class="vax-progress-bar">
                <div class="vax-progress-fill" style="width:${pct}%; background:${color};"></div>
            </div>
            <div class="vax-progress-pct">${pct}% מהתוקף חלף</div>
        </div>`;
}

// ── Reminder button HTML ──────────────────────────────────────────────
function buildReminderBtn(idHealth, reminderSet) {
    const active = +reminderSet === 1;
    return `<button class="btn-reminder${active ? ' btn-reminder--active' : ''}"
                onclick="toggleReminder(this, ${idHealth}, ${active ? 1 : 0})">
                <i class="fas fa-bell"></i>
                ${active ? 'תזכורת פעילה — בטל' : 'הזכר לי 15 ימים לפני'}
            </button>`;
}

// ── Render active card ────────────────────────────────────────────────
function renderActiveCard(v) {
    const el = document.getElementById('vax-active');
    const card = document.createElement('div');
    card.className = 'vax-card';
    card.dataset.id = v.id_health;

    const meta = [
        `<i class="fas fa-calendar-alt"></i> ניתן: ${fmtDate(v.date_given)}`,
        v.expiry_date ? `תפוגה: ${fmtDate(v.expiry_date)}` : '',
        v.vet_name    ? `<i class="fas fa-user-md"></i> ${v.vet_name}` : '',
        v.notes       ? `<i class="fas fa-sticky-note"></i> ${v.notes}` : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');

    card.innerHTML = `
        <div class="vax-card-header">
            <div class="vax-card-info">
                <strong>${v.vaccine_type}</strong>
                <small>${meta}</small>
            </div>
            <button class="vax-delete" onclick="deleteVaccine(this, ${v.id_health})" title="מחק">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        ${buildProgressBar(v)}
        <div class="vax-card-actions">
            ${buildReminderBtn(v.id_health, v.reminder_set)}
        </div>`;
    el.appendChild(card);
}

// ── Render future card ────────────────────────────────────────────────
function renderFutureCard(v) {
    const el   = document.getElementById('vax-future');
    const days = daysUntil(v.date_given);
    const card = document.createElement('div');
    card.className = 'vax-card';
    card.dataset.id = v.id_health;

    const meta = [
        `<i class="fas fa-calendar-alt"></i> מתוכנן: ${fmtDate(v.date_given)}`,
        v.expiry_date ? `תפוגה: ${fmtDate(v.expiry_date)}` : '',
        v.vet_name    ? `<i class="fas fa-user-md"></i> ${v.vet_name}` : '',
        v.notes       ? `<i class="fas fa-sticky-note"></i> ${v.notes}` : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');

    card.innerHTML = `
        <div class="vax-card-header">
            <div class="vax-card-info">
                <strong>${v.vaccine_type}</strong>
                <small>${meta}</small>
                <span class="vax-badge vax-badge--future">בעוד ${days} ימים</span>
            </div>
            <button class="vax-delete" onclick="deleteVaccine(this, ${v.id_health})" title="מחק">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        <div class="vax-card-actions">
            ${buildReminderBtn(v.id_health, v.reminder_set)}
        </div>`;
    el.appendChild(card);
}

// ── Render history table ──────────────────────────────────────────────
function renderHistoryTable(rows) {
    const tbody = document.getElementById('vax-history-tbody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">אין חיסונים בהיסטוריה</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(v => `
        <tr>
            <td><strong>${v.vaccine_type}</strong></td>
            <td>${fmtDateShort(v.date_given)}</td>
            <td>${fmtDateShort(v.expiry_date)}</td>
            <td>${v.vet_name || '—'}</td>
            <td style="max-width:180px; word-break:break-word;">${v.notes || '—'}</td>
            <td>
                <button class="vax-delete" onclick="deleteVaccine(this, ${v.id_health})" title="מחק">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>`
    ).join('');
}

// ── Load all ──────────────────────────────────────────────────────────
async function loadVaccines() {
    ['vax-active', 'vax-future'].forEach(id => {
        document.getElementById(id).innerHTML = '<p class="vax-empty">טוען...</p>';
    });
    document.getElementById('vax-history-tbody').innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">טוען...</td></tr>';

    try {
        const res  = await fetch('api/vaccines.php');
        if (!res.ok) throw new Error();
        const list = await res.json();

        const active = list.filter(v => categorize(v) === 'active');
        const future = list.filter(v => categorize(v) === 'future');
        const done   = list.filter(v => categorize(v) === 'done');

        // Active
        const elActive = document.getElementById('vax-active');
        elActive.innerHTML = '';
        if (active.length) active.forEach(renderActiveCard);
        else elActive.innerHTML = '<p class="vax-empty">אין חיסונים פעילים כרגע</p>';

        // Future
        const elFuture = document.getElementById('vax-future');
        elFuture.innerHTML = '';
        if (future.length) future.forEach(renderFutureCard);
        else elFuture.innerHTML = '<p class="vax-empty">אין חיסונים מתוכננים</p>';

        // History
        renderHistoryTable(done);

    } catch {
        ['vax-active', 'vax-future'].forEach(id => {
            document.getElementById(id).innerHTML = '<p class="vax-empty">שגיאה בטעינה</p>';
        });
        document.getElementById('vax-history-tbody').innerHTML =
            '<tr><td colspan="6" style="text-align:center;color:#e74c3c;padding:20px;">שגיאה בטעינה</td></tr>';
    }
}

// ── Add ───────────────────────────────────────────────────────────────
async function addVaccine() {
    const typeEl   = document.getElementById('vax-type');
    const dateEl   = document.getElementById('vax-date');
    const expiryEl = document.getElementById('vax-expiry');
    const vetEl    = document.getElementById('vax-vet');
    const notesEl  = document.getElementById('vax-notes');

    const type   = typeEl.value.trim();
    const date   = dateEl.value;
    const expiry = expiryEl.value  || null;
    const vet    = vetEl.value.trim()   || null;
    const notes  = notesEl.value.trim() || null;

    [typeEl, dateEl].forEach(el => el.style.borderColor = '');
    if (!type) { typeEl.focus(); typeEl.style.borderColor = '#e74c3c'; return; }
    if (!date) { dateEl.focus(); dateEl.style.borderColor = '#e74c3c'; return; }

    const btn = document.querySelector('.vax-add-btn');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מוסיף...';

    try {
        const res = await fetch('api/vaccines.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ vaccine_type: type, date_given: date, expiry_date: expiry, vet_name: vet, notes }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.error || 'שגיאה בהוספה.'); return; }

        typeEl.value = ''; dateEl.value = '';
        expiryEl.value = ''; vetEl.value = ''; notesEl.value = '';
        await loadVaccines();
    } catch {
        alert('שגיאת רשת.');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-plus-circle"></i> הוסף חיסון';
    }
}

// ── Delete ────────────────────────────────────────────────────────────
async function deleteVaccine(btn, id) {
    btn.disabled = true;
    try {
        const res  = await fetch('api/vaccines.php', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_health: id }),
        });
        const data = await res.json();
        if (data.success) await loadVaccines();
    } catch {
        alert('שגיאת רשת.');
        btn.disabled = false;
    }
}

// ── Toggle reminder ───────────────────────────────────────────────────
async function toggleReminder(btn, idHealth, currentSet) {
    const newSet = currentSet ? 0 : 1;
    btn.disabled = true;
    try {
        const res  = await fetch('api/vaccines.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'reminder', id_health: idHealth, reminder_set: newSet }),
        });
        const data = await res.json();
        if (data.success) {
            btn.className = 'btn-reminder' + (newSet ? ' btn-reminder--active' : '');
            btn.innerHTML = `<i class="fas fa-bell"></i> ${newSet ? 'תזכורת פעילה — בטל' : 'הזכר לי 15 ימים לפני'}`;
            btn.onclick = () => toggleReminder(btn, idHealth, newSet);
        }
    } catch {
        alert('שגיאת רשת.');
    } finally {
        btn.disabled = false;
    }
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('vax-date').value = new Date().toISOString().split('T')[0];
});
loadVaccines();
