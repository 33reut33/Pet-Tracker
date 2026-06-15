// ── State ─────────────────────────────────────────────────────────────
let _currentType = 'visit';
let _allRecords  = [];
let _histFilter  = 'all';
let _weightChart = null;

const TYPES = {
    visit:      { label: 'ביקור וטרינר',  icon: 'fa-stethoscope',  color: '#2a9d8f' },
    medication: { label: 'תרופה / טיפול', icon: 'fa-pills',        color: '#e76f51' },
    weight:     { label: 'שקילה',         icon: 'fa-weight',       color: '#6c63ff' },
    other:      { label: 'אחר',           icon: 'fa-notes-medical', color: '#457b9d' },
};

// ── Helpers ───────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
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
function isActive(r) {
    if (r.record_type === 'weight' || r.record_type === 'visit') return false;
    const today = todayStr();
    if (r.date_start > today) return false;
    if (r.date_end && r.date_end < today) return false;
    return true;
}

// ── Form type ─────────────────────────────────────────────────────────
function setType(type) {
    _currentType = type;
    document.querySelectorAll('.med-type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.type === type)
    );

    const isWeight = type === 'weight';
    const hasDur   = type === 'medication' || type === 'other';
    const hasVet   = type === 'visit' || type === 'medication';

    document.getElementById('fg-title').style.display  = isWeight ? 'none' : '';
    document.getElementById('fg-weight').style.display = isWeight ? ''     : 'none';
    document.getElementById('fg-end').style.display    = hasDur   ? ''     : 'none';
    document.getElementById('fg-vet').style.display    = hasVet   ? ''     : 'none';

    const titleEl = document.getElementById('med-title');
    if (type === 'visit')           titleEl.placeholder = 'בדיקה שגרתית, ניתוח, חיסון...';
    else if (type === 'medication') titleEl.placeholder = 'שם התרופה / הטיפול';
    else                            titleEl.placeholder = 'כותרת הרשומה';
}

// ── Load ──────────────────────────────────────────────────────────────
async function loadMedical() {
    try {
        const res = await fetch('api/medical.php');
        if (!res.ok) throw new Error();
        _allRecords = await res.json();
        if (_allRecords.error) throw new Error(_allRecords.error);
        renderAll();
    } catch {
        document.getElementById('med-active').innerHTML   = '<p class="med-empty">שגיאה בטעינה</p>';
        document.getElementById('weight-latest').innerHTML = '<p class="med-empty">שגיאה בטעינה</p>';
    }
}

function renderAll() {
    renderActive();
    renderVisits();
    renderWeightSection();
    renderHistory(_histFilter);
}

// ── Active treatments ─────────────────────────────────────────────────
function renderActive() {
    const el      = document.getElementById('med-active');
    const actives = _allRecords.filter(isActive);

    if (!actives.length) {
        el.innerHTML = '<p class="med-empty">אין טיפולים פעילים כרגע</p>';
        return;
    }
    el.innerHTML = '';
    actives.forEach(r => {
        const t    = TYPES[r.record_type] || TYPES.other;
        const card = document.createElement('div');
        card.className = 'med-card';

        let remain = null;
        if (r.date_end) {
            const diff = new Date(r.date_end + 'T00:00:00') - new Date();
            remain = Math.ceil(diff / 86400000);
        }
        const remainHtml = remain !== null
            ? `<span class="med-remain" style="color:${remain <= 0 ? '#e74c3c' : remain <= 3 ? '#e76f51' : remain <= 7 ? '#f4a261' : '#2a9d8f'};">
                   <i class="fas fa-hourglass-half"></i>
                   ${remain > 0 ? 'נגמר בעוד ' + remain + ' ימים' : 'הסתיים היום'}
               </span>`
            : '<span class="med-remain" style="color:#bbb;"><i class="fas fa-infinity"></i> ללא תאריך סיום</span>';

        const meta = [
            `<i class="fas fa-calendar-alt"></i> ${fmtDate(r.date_start)}`,
            r.vet_name ? `<i class="fas fa-user-md"></i> ${r.vet_name}` : '',
            r.notes    ? `<i class="fas fa-sticky-note"></i> ${r.notes}` : '',
        ].filter(Boolean).join(' &nbsp;·&nbsp; ');

        card.innerHTML = `
            <div class="med-card-header">
                <div class="med-card-info">
                    <div class="med-card-title">
                        <span class="med-type-badge"
                              style="background:${t.color}18; color:${t.color}; border-color:${t.color}40;">
                            <i class="fas ${t.icon}"></i> ${t.label}
                        </span>
                        <strong>${r.title}</strong>
                    </div>
                    <small>${meta}</small>
                    <div>${remainHtml}</div>
                </div>
                <button class="med-delete" onclick="deleteRecord(this, ${r.id_record})" title="מחק">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>`;
        el.appendChild(card);
    });
}

// ── Vet visits ────────────────────────────────────────────────────────
function renderVisits() {
    const el    = document.getElementById('med-visits');
    const today = todayStr();

    const visits = _allRecords
        .filter(r => r.record_type === 'visit')
        .sort((a, b) => a.date_start.localeCompare(b.date_start));

    const upcoming = visits.filter(r => r.date_start >= today);
    const recent   = visits.filter(r => r.date_start <  today).slice(-3).reverse();
    const toShow   = [...upcoming, ...recent];

    if (!toShow.length) {
        el.innerHTML = '<p class="med-empty">אין ביקורים רשומים</p>';
        return;
    }
    el.innerHTML = '';
    toShow.forEach(r => {
        const isFuture = r.date_start >= today;
        const daysAway = Math.ceil((new Date(r.date_start + 'T00:00:00') - new Date()) / 86400000);
        const absDays  = Math.abs(daysAway);

        let timeBadge;
        if (isFuture) {
            const col = daysAway <= 3 ? '#e74c3c' : daysAway <= 7 ? '#f4a261' : '#2a9d8f';
            timeBadge = `<span class="med-remain" style="color:${col};">
                <i class="fas fa-clock"></i> בעוד ${daysAway} ימים
            </span>`;
        } else {
            timeBadge = `<span class="med-remain" style="color:#bbb;">
                <i class="fas fa-check-circle"></i> לפני ${absDays} ימים
            </span>`;
        }

        const meta = [
            `<i class="fas fa-calendar-alt"></i> ${fmtDate(r.date_start)}`,
            r.vet_name ? `<i class="fas fa-user-md"></i> ${r.vet_name}` : '',
            r.notes    ? `<i class="fas fa-sticky-note"></i> ${r.notes}` : '',
        ].filter(Boolean).join(' &nbsp;·&nbsp; ');

        const card = document.createElement('div');
        card.className = 'med-card';
        card.dataset.id = r.id_record;
        card.innerHTML = `
            <div class="med-card-header">
                <div class="med-card-info">
                    <div class="med-card-title">
                        <span class="med-type-badge"
                              style="background:rgba(42,157,143,0.12); color:#2a9d8f; border-color:rgba(42,157,143,0.3);">
                            <i class="fas fa-stethoscope"></i> ביקור וטרינר
                        </span>
                        <strong>${r.title}</strong>
                    </div>
                    <small>${meta}</small>
                    <div>${timeBadge}</div>
                </div>
                <button class="med-delete" onclick="deleteRecord(this, ${r.id_record})" title="מחק">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            <div class="med-card-actions">
                ${buildVisitReminderBtn(r.id_record, r.reminder_set)}
            </div>`;
        el.appendChild(card);
    });
}

function buildVisitReminderBtn(idRecord, reminderSet) {
    const active = +reminderSet === 1;
    if (active) {
        return `<button class="btn-visit-reminder btn-visit-reminder--active"
                    onclick="toggleVisitReminder(this, ${idRecord}, 1)">
                    <i class="fas fa-bell"></i> תזכורת פעילה — בטל
                </button>`;
    }
    return `<div class="visit-reminder-row">
                <button class="btn-visit-reminder"
                        onclick="toggleVisitReminder(this, ${idRecord}, 0)">
                    <i class="fas fa-bell"></i> הזכר לי
                </button>
                <select class="visit-reminder-select" id="days-${idRecord}">
                    <option value="1">יום לפני</option>
                    <option value="3">3 ימים לפני</option>
                    <option value="7">שבוע לפני</option>
                </select>
            </div>`;
}

async function toggleVisitReminder(btn, idRecord, currentSet) {
    const newSet     = currentSet ? 0 : 1;
    const selectEl   = document.getElementById('days-' + idRecord);
    const daysBefore = selectEl ? parseInt(selectEl.value) : 1;

    btn.disabled = true;
    try {
        const res = await fetch('api/medical.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                action: 'reminder', id_record: idRecord,
                reminder_set: newSet, days_before: daysBefore,
            }),
        });
        const data = await res.json();
        if (data.success) {
            const actionsDiv = btn.closest('.med-card-actions');
            actionsDiv.innerHTML = buildVisitReminderBtn(idRecord, newSet);
        }
    } catch {
        alert('שגיאת רשת.');
    } finally {
        btn.disabled = false;
    }
}

// ── Weight section ────────────────────────────────────────────────────
function renderWeightSection() {
    const weights = _allRecords
        .filter(r => r.record_type === 'weight' && r.weight_kg)
        .sort((a, b) => {
            const d = a.date_start.localeCompare(b.date_start);
            return d !== 0 ? d : (a.id_record - b.id_record); // même date → ordre d'insertion
        })
        .slice(-12);

    const latestEl = document.getElementById('weight-latest');
    const chartWrap = document.getElementById('weight-chart-wrap');

    if (!weights.length) {
        latestEl.innerHTML = '<p class="med-empty" style="padding:16px 0;">אין מדידות משקל עדיין</p>';
        chartWrap.style.display = 'none';
        return;
    }

    const last = weights[weights.length - 1];
    let trend = '';
    if (weights.length >= 2) {
        const prev = parseFloat(weights[weights.length - 2].weight_kg);
        const curr = parseFloat(last.weight_kg);
        const diff = (curr - prev).toFixed(1);
        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
        const col   = diff > 0 ? '#e74c3c' : diff < 0 ? '#2a9d8f' : '#aaa';
        trend = `<div class="weight-trend" style="color:${col};">${arrow} ${Math.abs(diff)} ק"ג</div>`;
    }

    latestEl.innerHTML = `
        <div class="weight-big">${parseFloat(last.weight_kg).toFixed(1)}<span> ק"ג</span></div>
        <div class="weight-date">${fmtDateShort(last.date_start)}</div>
        ${trend}`;

    if (weights.length < 2) {
        chartWrap.style.display = 'none';
        return;
    }
    chartWrap.style.display = '';

    const ctx = document.getElementById('weight-chart').getContext('2d');
    if (_weightChart) _weightChart.destroy();
    _weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weights.map(w => fmtDateShort(w.date_start)),
            datasets: [{
                data:                weights.map(w => Math.round(parseFloat(w.weight_kg) * 10) / 10),
                borderColor:         '#6c63ff',
                backgroundColor:     'rgba(108,99,255,0.08)',
                borderWidth:         2.5,
                pointRadius:         4,
                pointBackgroundColor:'#6c63ff',
                tension:             0.35,
                fill:                true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => c.parsed.y + ' ק"ג' } }
            },
            scales: {
                x: { ticks: { font: { size: 9 }, color: '#888', maxRotation: 30 }, grid: { display: false } },
                y: {
                    ticks: { callback: v => (+v.toFixed(1)) + ' ק"ג', font: { size: 10 }, color: '#888' },
                    grid:  { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });
}

// ── History ───────────────────────────────────────────────────────────
function renderHistory(filter) {
    _histFilter = filter;
    document.querySelectorAll('.hist-filter-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === filter)
    );

    const tbody = document.getElementById('med-history-tbody');
    let rows = filter === 'all' ? _allRecords : _allRecords.filter(r => r.record_type === filter);

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">אין רשומות</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(r => {
        const t = TYPES[r.record_type] || TYPES.other;
        const lastCol = r.record_type === 'weight' && r.weight_kg
            ? `${parseFloat(r.weight_kg).toFixed(1)} ק"ג`
            : (r.vet_name || '—');
        return `
        <tr>
            <td>
                <span class="med-type-badge"
                      style="background:${t.color}18; color:${t.color}; border-color:${t.color}40; font-size:0.74rem;">
                    <i class="fas ${t.icon}"></i> ${t.label}
                </span>
            </td>
            <td><strong>${r.title}</strong>${r.notes ? `<br><small style="color:#aaa;">${r.notes}</small>` : ''}</td>
            <td>${fmtDateShort(r.date_start)}</td>
            <td>${fmtDateShort(r.date_end)}</td>
            <td>${lastCol}</td>
            <td>
                <button class="med-delete" onclick="deleteRecord(this, ${r.id_record})" title="מחק">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Add ───────────────────────────────────────────────────────────────
async function addRecord() {
    const type     = _currentType;
    const isWeight = type === 'weight';

    const titleEl  = document.getElementById('med-title');
    const dateEl   = document.getElementById('med-date');
    const endEl    = document.getElementById('med-end-date');
    const vetEl    = document.getElementById('med-vet');
    const notesEl  = document.getElementById('med-notes');
    const weightEl = document.getElementById('med-weight-kg');

    const title    = isWeight ? 'שקילה' : titleEl.value.trim();
    const date     = dateEl.value;
    const dateEnd  = endEl.value || null;
    const vet      = vetEl.value.trim()   || null;
    const notes    = notesEl.value.trim() || null;
    const weightKg = isWeight ? parseFloat(weightEl.value) : null;

    [titleEl, dateEl, weightEl].forEach(el => { if (el) el.style.borderColor = ''; });
    if (!isWeight && !title) { titleEl.focus(); titleEl.style.borderColor = '#e74c3c'; return; }
    if (!date)               { dateEl.focus();  dateEl.style.borderColor  = '#e74c3c'; return; }
    if (isWeight && (!weightEl.value || isNaN(weightKg) || weightKg <= 0)) {
        weightEl.focus(); weightEl.style.borderColor = '#e74c3c'; return;
    }

    const btn = document.querySelector('.med-add-btn');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מוסיף...';

    try {
        const res = await fetch('api/medical.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                record_type: type,
                title,
                date_start:  date,
                date_end:    dateEnd,
                vet_name:    vet,
                notes,
                weight_kg:   weightKg,
            }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.error || 'שגיאה בהוספה.'); return; }

        titleEl.value = ''; endEl.value = ''; vetEl.value = '';
        notesEl.value = ''; weightEl.value = '';
        dateEl.value = new Date().toISOString().split('T')[0];

        // Sync sidebar en temps réel si c'est une pesée
        if (type === 'weight' && weightKg && window.currentPet) {
            window.currentPet.weight = weightKg;
            if (window.updateSidebarPet) window.updateSidebarPet(window.currentPet);
        }

        await loadMedical();
    } catch {
        alert('שגיאת רשת.');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-plus-circle"></i> הוסף רשומה';
    }
}

// ── Delete ────────────────────────────────────────────────────────────
async function deleteRecord(btn, id) {
    btn.disabled = true;
    try {
        const res  = await fetch('api/medical.php', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_record: id }),
        });
        const data = await res.json();
        if (data.success) await loadMedical();
    } catch {
        alert('שגיאת רשת.');
        btn.disabled = false;
    }
}

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('med-date').value = new Date().toISOString().split('T')[0];
    setType('visit');
});
loadMedical();
