// ── State ─────────────────────────────────────────────────────────────
let _map, _marker;
let _petLoc        = [32.0514, 34.7603];
let _lastGpsPos    = null;   // dernière position GPS reçue
let _lastMovedAt   = null;   // timestamp du dernier déplacement ≥ MOVE_M
let _gpsActive     = false;
let _inactiveStart     = null;
let _alertShown        = false;
let _threshold         = 10;   // secondes — 10s défaut (test)
let _sleepMode         = false;
let _sleepModeStarted  = 0;    // timestamp d'activation du mode veille
let _hourlyChart   = null;
let _weeklyChart   = null;

const MOVE_M  = 20;   // mètres — déplacement minimum pour "en mouvement"
const GRACE_S = 15;   // secondes après le dernier mouvement avant de basculer "au repos"

// ── Map ───────────────────────────────────────────────────────────────
function initMap() {
    _map = L.map('map-activity').setView(_petLoc, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(_map);
    _marker = L.marker(_petLoc, {
        icon: L.divIcon({
            html: '<div class="map-icon-wrapper dog-wrapper" style="width:44px;height:44px;font-size:1.3rem;"><i class="fas fa-dog"></i></div>',
            className: 'custom-div-icon',
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        }),
        zIndexOffset: 1000
    }).addTo(_map);
}

// ── GPS live — source primaire pour la détection de mouvement ─────────
function initGPS() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition(pos => {
        _gpsActive = true;
        const loc  = [pos.coords.latitude, pos.coords.longitude];

        if (_lastGpsPos === null) {
            // Première lecture GPS — on initialise _lastMovedAt maintenant
            _lastMovedAt = Date.now();
        } else {
            const dist = _map.distance(loc, _lastGpsPos);
            if (dist >= MOVE_M) {
                _lastMovedAt = Date.now(); // déplacement significatif
            }
        }
        _lastGpsPos = loc;

        // Mise à jour carte
        _petLoc = loc;
        _marker.setLatLng(loc);
        _map.panTo(loc);

        document.getElementById('last-updated').textContent =
            new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    }, () => {
        _gpsActive = false;
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
}

// ── Ticker 1 s — détection d'inactivité ──────────────────────────────
setInterval(() => {
    if (!_gpsActive || _lastMovedAt === null) return;

    const badge         = document.getElementById('live-badge');
    const wrap          = document.getElementById('inactive-timer-wrap');
    const secsSinceMove = Math.floor((Date.now() - _lastMovedAt) / 1000);

    // ── Mode veille : statut forcé "au repos", alerte sur réveil ─────
    if (_sleepMode) {
        badge.className    = 'live-badge resting';
        badge.innerHTML    = '<i class="fas fa-moon"></i> במנוחה';
        wrap.style.display = 'none';

        // Mouvement détecté APRÈS l'activation du mode veille = réveil
        const woke = _lastMovedAt > _sleepModeStarted && secsSinceMove < GRACE_S;
        if (woke && !_alertShown) {
            _alertShown = true;
            document.getElementById('inact-modal-icon').className  = 'fas fa-sun pulse-icon';
            document.getElementById('inact-modal-icon').style.color = '#f4a261';
            document.getElementById('inact-modal-title').textContent = 'שינוי סטטוס!';
            document.getElementById('inact-modal-text').textContent  = 'החיה זזה! ייתכן שהתעוררה.';
            document.getElementById('inactivity-modal').classList.add('open');
        }
        // Re-armer quand l'animal se rendort
        if (secsSinceMove >= GRACE_S) _alertShown = false;
        return;
    }

    // ── Mode normal : alerte après inactivité ─────────────────────────
    const isMoving = secsSinceMove < GRACE_S;

    if (isMoving) {
        badge.className    = 'live-badge moving';
        badge.innerHTML    = '<i class="fas fa-running"></i> בתנועה';
        _inactiveStart     = null;
        _alertShown        = false;
        wrap.style.display = 'none';
        return;
    }

    badge.className = 'live-badge resting';
    badge.innerHTML = '<i class="fas fa-moon"></i> במנוחה';
    if (!_inactiveStart) _inactiveStart = _lastMovedAt + GRACE_S * 1000;

    const inactiveSecs = Math.max(0, Math.floor((Date.now() - _inactiveStart) / 1000));
    wrap.style.display = 'inline-flex';
    document.getElementById('inactive-timer').textContent = fmtTimer(inactiveSecs);

    if (inactiveSecs >= _threshold && !_alertShown) {
        _alertShown = true;
        document.getElementById('inact-modal-icon').className   = 'fas fa-bed pulse-icon';
        document.getElementById('inact-modal-icon').style.color = '#f4a261';
        document.getElementById('inact-modal-title').textContent = 'חוסר תנועה!';
        document.getElementById('inact-modal-text').textContent  =
            'החיה לא זזה כבר ' + fmtTimer(inactiveSecs) + '! אנא בדוק אם הכל בסדר.';
        document.getElementById('inactivity-modal').classList.add('open');
    }
}, 1000);

// ── Data load (graphiques + stats + fallback position) ────────────────
async function loadActivityData() {
    try {
        const r = await fetch('api/activity.php');
        if (!r.ok) return;
        const d = await r.json();

        // Si GPS indisponible : on utilise la position et le statut de la DB
        if (!_gpsActive && d.status && d.status.latitude) {
            _petLoc = [+d.status.latitude, +d.status.longitude];
            _marker.setLatLng(_petLoc);
            _map.panTo(_petLoc);

            const moving = !!+d.status.is_moving;
            const badge  = document.getElementById('live-badge');
            badge.className = 'live-badge ' + (moving ? 'moving' : 'resting');
            badge.innerHTML = moving
                ? '<i class="fas fa-running"></i> בתנועה'
                : '<i class="fas fa-moon"></i> במנוחה';

            if (d.status.recorded_at) {
                const t = new Date(d.status.recorded_at.replace(' ', 'T'));
                document.getElementById('last-updated').textContent =
                    t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            }
        }

        updateTodayStats(d.today);
        renderHourlyChart(d.hourly);
        renderWeeklyChart(d.weekly);
    } catch (e) { console.error('Activity load error:', e); }
}

// ── Today stats ───────────────────────────────────────────────────────
function updateTodayStats(t) {
    if (!t) return;
    const dist = t.distance_meters >= 1000
        ? (t.distance_meters / 1000).toFixed(2) + ' ק"מ'
        : t.distance_meters + ' מ\'';
    document.getElementById('stat-distance').textContent  = dist;
    document.getElementById('stat-active').textContent    = fmtTime(t.active_seconds);
    document.getElementById('stat-inactive').textContent  = fmtTime(t.inactive_seconds);
}

// ── Hourly chart ──────────────────────────────────────────────────────
function renderHourlyChart(hourly) {
    const ctx    = document.getElementById('hourly-chart').getContext('2d');
    const labels = hourly.map((_, i) => String(i).padStart(2, '0') + ':00');
    const pct    = hourly.map(h => h.total > 0 ? Math.round(h.moving / h.total * 100) : 0);
    const colors = pct.map(v => v === 0 ? 'rgba(0,0,0,0.07)' : v >= 50 ? '#2a9d8f' : '#f4a261');

    if (_hourlyChart) _hourlyChart.destroy();
    _hourlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ data: pct, backgroundColor: colors, borderRadius: 3, borderSkipped: false }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => c.parsed.y + '% פעיל' } }
            },
            scales: {
                x: { ticks: { font: { size: 9 }, maxRotation: 45, color: '#888' }, grid: { display: false } },
                y: {
                    min: 0, max: 100,
                    ticks: { callback: v => v + '%', font: { size: 10 }, color: '#888', stepSize: 25 },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });
}

// ── Weekly chart ──────────────────────────────────────────────────────
function renderWeeklyChart(weekly) {
    const ctx       = document.getElementById('weekly-chart').getContext('2d');
    const labels    = weekly.map(w => {
        const d = new Date(w.day + 'T00:00:00');
        return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
    });
    const activeMin = weekly.map(w => Math.round(w.moving * 15 / 60));
    const restMin   = weekly.map(w => Math.round((w.total - w.moving) * 15 / 60));

    if (_weeklyChart) _weeklyChart.destroy();
    _weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'פעיל (דקות)',  data: activeMin, backgroundColor: '#2a9d8f', borderRadius: 4, stack: 's' },
                { label: 'מנוחה (דקות)', data: restMin,   backgroundColor: 'rgba(244,162,97,0.45)', stack: 's' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 10, color: '#555' } }
            },
            scales: {
                x: { stacked: true, ticks: { font: { size: 10 }, color: '#888' }, grid: { display: false } },
                y: { stacked: true, ticks: { callback: v => v + 'ד\'', font: { size: 10 }, color: '#888' }, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        }
    });
}

// ── Modal ─────────────────────────────────────────────────────────────
function closeInactivityModal() {
    document.getElementById('inactivity-modal').classList.remove('open');
}

// ── Threshold ─────────────────────────────────────────────────────────
function updateThreshold(val) {
    _sleepMode     = (val === 'sleep');
    _threshold     = _sleepMode ? 0 : +val;
    _alertShown    = false;
    _inactiveStart = null;
    if (_sleepMode) {
        _sleepModeStarted = Date.now();
        // Forcer immédiatement le badge "au repos"
        const badge = document.getElementById('live-badge');
        badge.className = 'live-badge resting';
        badge.innerHTML = '<i class="fas fa-moon"></i> במנוחה';
        document.getElementById('inactive-timer-wrap').style.display = 'none';
    }
}

// ── Formatters ────────────────────────────────────────────────────────
function fmtTime(secs) {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    if (m < 60) return m + ' ד\'';
    const h  = Math.floor(m / 60);
    const rm = m % 60;
    return h + 'ש\'' + (rm ? ' ' + rm + 'ד\'' : '');
}
function fmtTimer(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return (h > 0 ? h + ':' : '') +
           String(m).padStart(2, '0') + ':' +
           String(s).padStart(2, '0');
}

// ── Bootstrap ─────────────────────────────────────────────────────────
initMap();
initGPS();
loadActivityData().then(() => {
    setInterval(loadActivityData, 5 * 60 * 1000);
});
