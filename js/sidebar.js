const NAV_ITEMS = [
    { href: 'index.html',        icon: 'fa-th-large',       label: 'דף הבית' },
    { href: 'map.html',          icon: 'fa-map-marked-alt', label: 'מיקום חי' },
    { href: 'activity.html',     icon: 'fa-running',        label: 'רמת פעילות' },
    { href: 'vaccines.html',     icon: 'fa-syringe',        label: 'חיסונים' },
    { href: 'medical.html',      icon: 'fa-file-medical',   label: 'תיק רפואי' },
    { href: 'profil.html',       icon: 'fa-id-card',        label: 'הפרופיל שלי' },
];

async function sidebarLogout() {
    try { await fetch('api/logout.php'); } catch { /* ignore */ }
    window.location.href = 'login.html';
}

function toggleSidebar() {
    const nav     = document.querySelector('.glass-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const btn     = document.querySelector('.hamburger-btn');
    nav.classList.toggle('open');
    overlay.classList.toggle('open');
    btn.classList.toggle('open');
}

function closeSidebar() {
    document.querySelector('.glass-sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('open');
    document.querySelector('.hamburger-btn').classList.remove('open');
}

(function buildSidebar() {
    const page = location.pathname.split('/').pop() || 'index.html';

    const items = NAV_ITEMS.map(({ href, icon, label }) => `
        <li>
            <a href="${href}"${page === href ? ' class="active"' : ''}>
                <i class="fas ${icon}"></i>${label}
            </a>
        </li>
    `).join('');

    const logoutItem = `
        <li class="signup-item">
            <a href="#" onclick="sidebarLogout(); return false;" class="logout-nav">
                <i class="fas fa-sign-out-alt"></i>התנתקות
            </a>
        </li>
    `;

    const root = document.getElementById('sidebar-root');
    root.outerHTML = `
        <div class="sidebar-overlay" onclick="closeSidebar()"></div>
        <button class="hamburger-btn" onclick="toggleSidebar()" aria-label="תפריט">
            <span></span><span></span><span></span>
        </button>
        <nav class="glass-sidebar">
            <div class="brand">
                <div class="logo-icon"><i class="fas fa-paw"></i></div>
                <h2>Pet Tracker</h2>
                <div id="sidebar-pet-name" class="sidebar-pet-name"></div>
            </div>
            <ul class="nav-menu">${items}${logoutItem}</ul>
        </nav>
    `;
})();
