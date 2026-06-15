'use strict';

const API_PROFILE  = 'api/profile.php';
const API_PET      = 'api/pet.php';
const API_PETS     = 'api/pets.php';
const API_PASSWORD = 'api/password.php';
const API_PHOTO    = 'api/upload_photo.php';
const API_SELECT   = 'api/select_pet.php';

let _currentPet  = null;
let _allPets     = [];
let _activePetId = null;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    waitForAuth(loadAll);
    const pwNew = document.getElementById('pw-new');
    if (pwNew) pwNew.addEventListener('input', updateStrengthBar);
});

function waitForAuth(cb) {
    if (window.currentPet !== undefined) { cb(); return; }
    let tries = 0;
    const t = setInterval(() => {
        if (window.currentPet !== undefined || ++tries > 40) {
            clearInterval(t);
            cb();
        }
    }, 100);
}

function loadAll() {
    Promise.all([
        fetch(API_PROFILE).then(r => r.json()),
        fetch(API_PETS).then(r => r.json()),
    ]).then(([profile, pets]) => {
        _currentPet  = profile.pet   || null;
        _activePetId = _currentPet ? +_currentPet.id_pet : null;
        _allPets     = Array.isArray(pets) ? pets : [];

        fillOwner(profile.owner);
        fillPet(_currentPet);
        renderPetList();
    }).catch(() => {
        showMsg('pet-save-msg', 'שגיאה בטעינת הנתונים', 'error');
    });
}

// ── Species helpers ──────────────────────────────────────────────────────────
const SPECIES_EMOJI = { dog:'🐶', cat:'🐱', rabbit:'🐰', other:'🐾' };
const SPECIES_LABEL = { dog:'כלב', cat:'חתול', rabbit:'ארנב', other:'אחר' };
function speciesEmoji(s) { return SPECIES_EMOJI[s] || '🐾'; }
function speciesLabel(s) { return SPECIES_LABEL[s] || s || '—'; }

function calcAge(birthDate) {
    if (!birthDate) return null;
    const b   = new Date(birthDate);
    const now = new Date();
    let years  = now.getFullYear() - b.getFullYear();
    let months = now.getMonth()    - b.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years >= 2)  return years + ' שנים';
    if (years === 1) return 'שנה ו-' + months + ' חודשים';
    if (months > 0)  return months + ' חודשים';
    const days = Math.floor((now - b) / 86400000);
    return days + ' ימים';
}

// ── Fill pet form ────────────────────────────────────────────────────────────
function fillPet(pet) {
    if (!pet) {
        document.getElementById('p-name-display').textContent = '—';
        return;
    }

    // Hero display
    document.getElementById('p-name-display').textContent    = pet.name || '—';
    document.getElementById('p-species-display').textContent = speciesEmoji(pet.species) + ' ' + speciesLabel(pet.species);

    const age    = calcAge(pet.birth_date);
    const weight = pet.weight ? parseFloat(pet.weight).toFixed(1) + ' ק"ג' : null;
    document.getElementById('p-age-display').textContent    = age    || '—';
    document.getElementById('p-weight-display').textContent = weight || '—';

    // Photo or emoji
    if (pet.photo_url) {
        _showPhoto(pet.photo_url);
    } else {
        document.getElementById('p-emoji').textContent        = speciesEmoji(pet.species);
        document.getElementById('p-emoji').style.display      = '';
        document.getElementById('p-photo').style.display      = 'none';
        document.getElementById('p-remove-btn').style.display = 'none';
    }

    // Form fields
    document.getElementById('p-name').value       = pet.name       || '';
    document.getElementById('p-species').value    = pet.species    || 'dog';
    document.getElementById('p-breed').value      = pet.breed      || '';
    document.getElementById('p-birth-date').value = pet.birth_date ? pet.birth_date.substring(0, 10) : '';
    document.getElementById('p-weight').value     = pet.weight     || '';
    document.getElementById('p-vet').value        = pet.vet_name   || '';
    document.getElementById('p-collar').value     = pet.collar_id  || '';
}

// ── Fill owner form ──────────────────────────────────────────────────────────
function fillOwner(owner) {
    if (!owner) return;
    document.getElementById('o-first-name').value = owner.first_name || '';
    document.getElementById('o-last-name').value  = owner.last_name  || '';
    document.getElementById('o-phone').value      = owner.phone      || '';
    document.getElementById('o-email').value      = owner.email      || '';
}

// ── Render pet list ──────────────────────────────────────────────────────────
function renderPetList() {
    const container = document.getElementById('pets-list');
    if (!_allPets.length) {
        container.innerHTML = '<p class="profil-empty">אין חיות רשומות</p>';
        return;
    }
    container.innerHTML = _allPets.map(p => {
        const isActive = +p.id_pet === _activePetId;
        const age      = calcAge(p.birth_date);
        return `
        <div class="pet-list-item${isActive ? ' active-pet' : ''}">
            <div class="pet-list-emoji">${speciesEmoji(p.species)}</div>
            <div class="pet-list-info">
                <strong>${escHtml(p.name)}</strong>
                <small>${speciesLabel(p.species)}${p.breed ? ' · ' + escHtml(p.breed) : ''}${age ? ' · ' + age : ''}</small>
            </div>
            ${isActive
                ? '<span class="pet-list-active-badge">פעיל</span>'
                : `<button class="btn-switch-pet" onclick="switchPet(${+p.id_pet})">בחר</button>`
            }
        </div>`;
    }).join('');
}

// ── Switch active pet ────────────────────────────────────────────────────────
function switchPet(petId) {
    fetch(API_SELECT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pet_id: petId }),
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) { window.location.reload(); }
        else           { alert(d.error || 'שגיאה בבחירת חיה'); }
    });
}

// ── Add new pet ──────────────────────────────────────────────────────────────
function toggleAddPet() {
    const form = document.getElementById('add-pet-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function addNewPet() {
    const name = (document.getElementById('new-pet-name').value || '').trim();
    if (!name) { alert('נא להזין שם חיה'); return; }

    fetch(API_PET, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            species:    document.getElementById('new-pet-species').value || 'dog',
            breed:      document.getElementById('new-pet-breed').value   || null,
            birth_date: document.getElementById('new-pet-birth').value   || null,
        }),
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) { window.location.reload(); }
        else           { alert(d.error || 'שגיאה בהוספת חיה'); }
    });
}

// ── Save pet ─────────────────────────────────────────────────────────────────
function savePet() {
    const btn  = document.getElementById('pet-save-btn');
    btn.disabled = true;

    const body = {
        name:       document.getElementById('p-name').value.trim(),
        species:    document.getElementById('p-species').value,
        breed:      document.getElementById('p-breed').value.trim()      || null,
        birth_date: document.getElementById('p-birth-date').value        || null,
        weight:     document.getElementById('p-weight').value            || '',
        vet_name:   document.getElementById('p-vet').value.trim()        || null,
        collar_id:  document.getElementById('p-collar').value.trim()     || null,
    };

    if (!body.name) {
        showMsg('pet-save-msg', 'נא להזין שם', 'error');
        btn.disabled = false;
        return;
    }

    fetch(API_PET, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    })
    .then(r => r.json())
    .then(d => {
        if (d.success !== false) {
            showMsg('pet-save-msg', 'נשמר בהצלחה ✓', 'ok');

            // Refresh hero
            document.getElementById('p-name-display').textContent    = body.name;
            document.getElementById('p-species-display').textContent = speciesEmoji(body.species) + ' ' + speciesLabel(body.species);
            if (body.weight) document.getElementById('p-weight-display').textContent = parseFloat(body.weight).toFixed(1) + ' ק"ג';
            const age = calcAge(body.birth_date);
            if (age) document.getElementById('p-age-display').textContent = age;

            // Emoji refresh (when no photo)
            if (document.getElementById('p-photo').style.display === 'none') {
                document.getElementById('p-emoji').textContent = speciesEmoji(body.species);
            }

            // Sync sidebar
            if (_currentPet) {
                Object.assign(_currentPet, body);
                if (window.updateSidebarPet) window.updateSidebarPet(_currentPet);
            }

            // Refresh pet list
            const idx = _allPets.findIndex(p => +p.id_pet === _activePetId);
            if (idx !== -1) Object.assign(_allPets[idx], body);
            renderPetList();
        } else {
            showMsg('pet-save-msg', d.error || 'שגיאה', 'error');
        }
    })
    .catch(() => showMsg('pet-save-msg', 'שגיאת רשת', 'error'))
    .finally(() => { btn.disabled = false; });
}

// ── Save owner ───────────────────────────────────────────────────────────────
function saveOwner() {
    const btn = document.getElementById('owner-save-btn');
    btn.disabled = true;

    const body = {
        first_name: document.getElementById('o-first-name').value.trim(),
        last_name:  document.getElementById('o-last-name').value.trim(),
        phone:      document.getElementById('o-phone').value.trim(),
    };

    if (!body.first_name || !body.last_name) {
        showMsg('owner-save-msg', 'שם פרטי ושם משפחה הם שדות חובה', 'error');
        btn.disabled = false;
        return;
    }

    fetch(API_PROFILE, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) showMsg('owner-save-msg', 'נשמר בהצלחה ✓', 'ok');
        else           showMsg('owner-save-msg', d.error || 'שגיאה', 'error');
    })
    .catch(() => showMsg('owner-save-msg', 'שגיאת רשת', 'error'))
    .finally(() => { btn.disabled = false; });
}

// ── Password ─────────────────────────────────────────────────────────────────
function togglePwSection() {
    const sec  = document.getElementById('pw-section');
    const chev = document.getElementById('pw-chevron');
    const open = sec.style.display !== 'none';
    sec.style.display    = open ? 'none' : 'block';
    chev.style.transform = open ? '' : 'rotate(180deg)';
}

function togglePwVis(id, btn) {
    const input = document.getElementById(id);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
        input.type     = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type     = 'password';
        icon.className = 'fas fa-eye';
    }
}

function updateStrengthBar() {
    const val  = document.getElementById('pw-new').value;
    const bar  = document.getElementById('pw-strength-bar');
    const fill = document.getElementById('pw-strength-fill');
    const lbl  = document.getElementById('pw-strength-label');

    if (!val) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';

    let score = 0;
    if (val.length >= 8)             score++;
    if (val.length >= 12)            score++;
    if (/[A-Z]/.test(val))           score++;
    if (/[0-9]/.test(val))           score++;
    if (/[^A-Za-z0-9]/.test(val))   score++;

    const levels = [
        { pct:'20%',  bg:'#e74c3c', txt:'חלשה מאוד' },
        { pct:'40%',  bg:'#e67e22', txt:'חלשה' },
        { pct:'60%',  bg:'#f1c40f', txt:'בינונית' },
        { pct:'80%',  bg:'#2ecc71', txt:'חזקה' },
        { pct:'100%', bg:'#27ae60', txt:'חזקה מאוד' },
    ];
    const lvl = levels[Math.min(score, 4)];
    fill.style.width      = lvl.pct;
    fill.style.background = lvl.bg;
    lbl.textContent       = lvl.txt;
    lbl.style.color       = lvl.bg;
}

function changePassword() {
    const btn = document.getElementById('pw-save-btn');
    btn.disabled = true;

    fetch(API_PASSWORD, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            old_password:     document.getElementById('pw-old').value,
            new_password:     document.getElementById('pw-new').value,
            confirm_password: document.getElementById('pw-confirm').value,
        }),
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            showMsg('pw-save-msg', 'הסיסמה עודכנה בהצלחה ✓', 'ok');
            ['pw-old','pw-new','pw-confirm'].forEach(id => { document.getElementById(id).value = ''; });
            document.getElementById('pw-strength-bar').style.display = 'none';
        } else {
            showMsg('pw-save-msg', d.error || 'שגיאה', 'error');
        }
    })
    .catch(() => showMsg('pw-save-msg', 'שגיאת רשת', 'error'))
    .finally(() => { btn.disabled = false; });
}

// ── Photo ─────────────────────────────────────────────────────────────────────
function uploadPhoto(input) {
    if (!input.files.length) return;
    const formData = new FormData();
    formData.append('photo', input.files[0]);
    input.value = '';

    fetch(API_PHOTO, { method: 'POST', body: formData })
    .then(r => r.json())
    .then(d => {
        if (d.photo_url) {
            _showPhoto(d.photo_url);
            if (_currentPet) _currentPet.photo_url = d.photo_url;
        } else {
            alert(d.error || 'שגיאה בהעלאת תמונה');
        }
    })
    .catch(() => alert('שגיאת רשת'));
}

function _showPhoto(url) {
    const img = document.getElementById('p-photo');
    img.src                                                = url + '?t=' + Date.now();
    img.style.display                                      = 'block';
    document.getElementById('p-emoji').style.display      = 'none';
    document.getElementById('p-remove-btn').style.display = 'flex';
}

function removePetPhoto() {
    if (!confirm('להסיר את התמונה?')) return;
    fetch(API_PHOTO, { method: 'DELETE' })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            document.getElementById('p-photo').style.display        = 'none';
            document.getElementById('p-remove-btn').style.display   = 'none';
            document.getElementById('p-emoji').style.display        = '';
            document.getElementById('p-emoji').textContent          = speciesEmoji(_currentPet?.species || 'other');
            if (_currentPet) _currentPet.photo_url = null;
        }
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showMsg(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'save-msg ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; el.className = 'save-msg'; }, 4000);
}

function escHtml(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
