function togglePw(id, icon) {
    const input = document.getElementById(id);
    input.type  = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

async function handleLogin(e) {
    e.preventDefault();
    hideError();

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    const btn      = document.getElementById('login-btn');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return showError('נא להזין כתובת אימייל תקינה.');
    if (!password)
        return showError('נא להזין סיסמה.');

    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מתחבר...';

    try {
        const res  = await fetch('api/login.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) return showError(data.error || 'שגיאה בהתחברות.');

        if (remember) {
            localStorage.setItem('remembered_email', email);
        } else {
            localStorage.removeItem('remembered_email');
        }

        window.location.href = 'index.html';
    } catch {
        showError('שגיאת רשת. בדוק את החיבור לשרת.');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> כניסה לחשבון';
    }
}

function showForgotPassword() {
    const email = document.getElementById('login-email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('נא להזין כתובת אימייל תקינה לפני איפוס הסיסמה.');
        document.getElementById('login-email').focus();
        return;
    }
    showError('פנייה לאיפוס סיסמה נשלחה ל: ' + email + '. בדקו את תיבת הדואר.');
}

function showError(msg) {
    const el = document.getElementById('alert-error');
    el.innerHTML     = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    el.style.display = 'flex';
}

function hideError() {
    document.getElementById('alert-error').style.display = 'none';
}

// Pre-fill email if "remember me" was used last time
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('remembered_email');
    if (saved) {
        document.getElementById('login-email').value = saved;
        document.getElementById('remember-me').checked = true;
    }
});
