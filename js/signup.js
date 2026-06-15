function togglePw(id, icon) {
    const input = document.getElementById(id);
    input.type  = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('su-password').addEventListener('input', function () {
        const v = this.value;
        let score = 0;
        if (v.length >= 8)           score++;
        if (/[A-Z]/.test(v))         score++;
        if (/[0-9]/.test(v))         score++;
        if (/[^A-Za-z0-9]/.test(v))  score++;

        const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71'];
        const labels = ['חלשה', 'בינונית', 'טובה', 'חזקה'];
        const fill   = document.getElementById('pw-fill');
        const label  = document.getElementById('pw-label');

        fill.style.width      = (score * 25) + '%';
        fill.style.background = colors[score - 1] || '#eee';
        label.textContent     = v ? 'עוצמה: ' + (labels[score - 1] || '') : '';
    });
});

// ── Dynamic pet blocks ─────────────────────────────────────────────────────

const PET_OPTIONS = `
    <option value="dog">🐶 כלב</option>
    <option value="cat">🐱 חתול</option>
    <option value="rabbit">🐰 ארנב</option>
    <option value="other">🐾 אחר</option>`;

function addPetBlock(isFirst = false) {
    const container = document.getElementById('pets-container');
    const idx       = container.querySelectorAll('.pet-block').length;
    const num       = idx + 1;

    const block = document.createElement('div');
    block.className = 'pet-block';
    block.innerHTML = `
        <div class="pet-block-header">
            <span class="pet-block-label">🐾 חיה מספר ${num}</span>
            ${isFirst ? '' : '<button type="button" class="remove-pet-btn" onclick="removePetBlock(this)"><i class="fas fa-times"></i> הסר</button>'}
        </div>
        <div class="two-col">
            <div class="form-group">
                <label><i class="fas fa-paw"></i> שם החיה</label>
                <input type="text" name="pet-name" placeholder="לוקי">
            </div>
            <div class="form-group">
                <label><i class="fas fa-dog"></i> סוג החיה</label>
                <select name="pet-species">${PET_OPTIONS}</select>
            </div>
        </div>
        <div class="two-col" style="margin-top:12px;">
            <div class="form-group">
                <label><i class="fas fa-dna"></i> גזע</label>
                <input type="text" name="pet-breed" placeholder="גולדן רטריבר">
            </div>
            <div class="form-group">
                <label><i class="fas fa-birthday-cake"></i> תאריך לידה</label>
                <input type="date" name="pet-birth">
            </div>
        </div>
        <div class="two-col" style="margin-top:12px;">
            <div class="form-group">
                <label><i class="fas fa-tag"></i> מזהה קולר</label>
                <input type="text" name="pet-collar" placeholder="collar-001">
            </div>
            <div class="form-group">
                <label><i class="fas fa-weight"></i> משקל <small style="font-weight:400;color:#aaa;">(ק"ג)</small></label>
                <input type="number" name="pet-weight" placeholder="12.5" min="0" max="200" step="0.1">
            </div>
        </div>
        <div class="form-group" style="margin-top:12px;">
            <label><i class="fas fa-stethoscope"></i> שם הווטרינר</label>
            <input type="text" name="pet-vet" placeholder='ד"ר כהן'>
        </div>

        <!-- Vaccines -->
        <div class="vaccines-container" style="margin-top:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <label style="font-weight:600; color:#264653; margin:0;"><i class="fas fa-syringe"></i> חיסונים קיימים <small style="font-weight:400;color:#aaa;">(אופציונלי)</small></label>
                <button type="button" class="add-vax-btn" onclick="addVaccineRow(this)">
                    <i class="fas fa-plus"></i> הוסף חיסון
                </button>
            </div>
            <div class="vaccines-list"></div>
        </div>`;

    container.appendChild(block);
}

function removePetBlock(btn) {
    btn.closest('.pet-block').remove();
    document.querySelectorAll('.pet-block').forEach((b, i) => {
        b.querySelector('.pet-block-label').textContent = `🐾 חיה מספר ${i + 1}`;
    });
}

function addVaccineRow(btn) {
    const list = btn.closest('.vaccines-container').querySelector('.vaccines-list');
    const row  = document.createElement('div');
    row.className = 'vaccine-row';
    row.innerHTML = `
        <input type="text" name="vax-type" placeholder="סוג חיסון (כלבת, תולעים...)">
        <div class="vax-date-wrap">
            <small>📅 תאריך מתן</small>
            <input type="date" name="vax-given">
        </div>
        <div class="vax-date-wrap">
            <small>⏳ תאריך תפוגה</small>
            <input type="date" name="vax-expiry">
        </div>
        <button type="button" class="remove-vax-btn" onclick="this.closest('.vaccine-row').remove()">
            <i class="fas fa-times"></i>
        </button>`;
    list.appendChild(row);
}


// ── Signup submit ──────────────────────────────────────────────────────────

async function handleSignup(e) {
    e.preventDefault();
    hideAlerts();

    const firstName = document.getElementById('su-firstname').value.trim();
    const lastName  = document.getElementById('su-lastname').value.trim();
    const email     = document.getElementById('su-email').value.trim();
    const phone     = document.getElementById('su-phone').value.trim();
    const password  = document.getElementById('su-password').value;
    const confirm   = document.getElementById('su-confirm').value;
    const terms     = document.getElementById('su-terms').checked;
    const btn       = document.getElementById('signup-btn');

    if (!firstName || !lastName)   return showError('נא למלא שם פרטי ושם משפחה.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                                   return showError('נא להזין כתובת אימייל תקינה.');
    if (password.length < 8)       return showError('הסיסמה חייבת להכיל לפחות 8 תווים.');
    if (password !== confirm)      return showError('הסיסמאות אינן תואמות.');
    if (!terms)                    return showError('יש לאשר את תנאי השימוש להמשך.');

    // Collect all pet blocks
    const pets = [];
    document.querySelectorAll('.pet-block').forEach(block => {
        const name = block.querySelector('[name="pet-name"]').value.trim();
        if (!name) return;
        const vaccines = [...block.querySelectorAll('.vaccine-row')].map(r => ({
            vaccine_type: r.querySelector('[name="vax-type"]').value.trim(),
            date_given:   r.querySelector('[name="vax-given"]').value,
            expiry_date:  r.querySelector('[name="vax-expiry"]').value || null,
        })).filter(v => v.vaccine_type && v.date_given);

        pets.push({
            name,
            species:    block.querySelector('[name="pet-species"]').value,
            breed:      block.querySelector('[name="pet-breed"]').value.trim()   || null,
            birth_date: block.querySelector('[name="pet-birth"]').value          || null,
            collar_id:  block.querySelector('[name="pet-collar"]').value.trim()  || null,
            vet_name:   block.querySelector('[name="pet-vet"]').value.trim()     || null,
            weight:     block.querySelector('[name="pet-weight"]').value         || null,
            vaccines,
        });
    });
    if (!pets.length) return showError('נא להזין לפחות שם חיה אחת.');

    btn.disabled    = true;
    btn.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> רושם...';

    try {
        const res  = await fetch('api/signup.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ first_name: firstName, last_name: lastName, email, phone, password, pets }),
        });
        const data = await res.json();

        if (!res.ok) return showError(data.error || 'שגיאה בהרשמה.');

        document.getElementById('alert-success').style.display = 'flex';
        document.getElementById('signup-form').reset();
        document.getElementById('pw-fill').style.width = '0';
        document.getElementById('pw-label').textContent = '';
        // Reset pet blocks to just one empty block
        document.getElementById('pets-container').innerHTML = '';
        addPetBlock(true);

        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    } catch {
        showError('שגיאת רשת. בדוק את החיבור לשרת.');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> צרו חשבון עכשיו';
    }
}

function showError(msg) {
    const el = document.getElementById('alert-error');
    el.innerHTML     = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    el.style.display = 'flex';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideAlerts() {
    document.getElementById('alert-error').style.display   = 'none';
    document.getElementById('alert-success').style.display = 'none';
}
