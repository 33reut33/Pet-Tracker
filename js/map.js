let homeLocation = [32.0514, 34.7603];
let currentLoc   = [...homeLocation];
let alertActive  = false;
let safeRadius   = 70;
let lastSaveTick  = 0;
let _lastSavedLoc = null; // pour calculer is_moving entre deux sauvegardes
let activePet    = null;
let _gpsLastTick = 0; // timestamp du dernier fix GPS réel

// ── Pet helpers ───────────────────────────────────────────────────────────────

function petName()  { return activePet?.name    || 'החיה'; }
function petEmoji() {
    const s = activePet?.species || 'dog';
    return { dog: '🐶', cat: '🐱', rabbit: '🐰' }[s] || '🐾';
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function buildHomeIcon() {
    return L.divIcon({
        html: '<div class="map-icon-wrapper home-wrapper" style="width:54px;height:54px;font-size:1.4rem;"><i class="fas fa-home"></i><span class="icon-label">🏠 בית</span></div>',
        className: 'custom-div-icon', iconSize: [54, 54], iconAnchor: [27, 27]
    });
}
function buildPetIcon() {
    return L.divIcon({
        html: `<div class="map-icon-wrapper dog-wrapper"><i class="fas fa-paw"></i><span class="icon-label">${petEmoji()} ${petName()}</span></div>`,
        className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 20]
    });
}

// ── Map setup ─────────────────────────────────────────────────────────────────

const map = L.map('map-main', { zoomControl: false }).setView(homeLocation, 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const markerHome = L.marker(homeLocation, { icon: buildHomeIcon(), zIndexOffset: 0   }).addTo(map);
const markerPet  = L.marker(currentLoc,   { icon: buildPetIcon(),  zIndexOffset: 1000 }).addTo(map);
let distanceLine = L.polyline([homeLocation, currentLoc], { color: '#e74c3c', weight: 4, dashArray: '6, 6' }).addTo(map);
let safeCircle   = L.circle(homeLocation,  { radius: safeRadius, color: '#2a9d8f', fillOpacity: 0.05 }).addTo(map);

// ── Auth event: update pet icon once name is known ────────────────────────────

document.addEventListener('auth:ready', (e) => {
    activePet = e.detail?.pet || null;
    markerPet.setIcon(buildPetIcon());
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateDistanceDisplay(dist) {
    const el = document.getElementById('dist-status');
    if (!el) return;
    el.textContent  = dist + ' מטרים מהבית';
    el.style.color  = dist > safeRadius ? '#e74c3c' : '#2a9d8f';
}

function updateLastSeen(dateStr) {
    const el = document.getElementById('detail-last-seen');
    if (!el) return;
    el.textContent = dateStr
        ? new Date(dateStr).toLocaleString('he-IL')
        : new Date().toLocaleString('he-IL');
}

function updateAccuracy(meters) {
    const el = document.getElementById('detail-accuracy');
    if (!el) return;
    el.textContent = meters ? 'גבוה (' + Math.round(meters) + ' מטרים)' : 'GPS';
}

// ── Load data from DB ─────────────────────────────────────────────────────────

async function loadSafetyZone() {
    try {
        const res  = await fetch('api/safetyzone.php');
        if (!res.ok) return;
        const zone = await res.json();
        homeLocation = [+zone.center_lat, +zone.center_lng];
        safeRadius   = +zone.radius_meters;
        markerHome.setLatLng(homeLocation);
        safeCircle.setLatLng(homeLocation);
        safeCircle.setRadius(safeRadius);
        distanceLine.setLatLngs([homeLocation, currentLoc]);
        map.setView(homeLocation, 14);
    } catch { /* ignore */ }
}

async function loadLastLocation() {
    try {
        const res = await fetch('api/location.php');
        if (!res.ok) return;
        const loc = await res.json();

        if (!loc.latitude || !loc.longitude) return;

        currentLoc = [+loc.latitude, +loc.longitude];
        markerPet.setLatLng(currentLoc);
        distanceLine.setLatLngs([homeLocation, currentLoc]);

        const group = L.featureGroup([markerHome, markerPet]);
        map.fitBounds(group.getBounds().pad(0.4));

        const dist = Math.round(map.distance(currentLoc, homeLocation));
        updateDistanceDisplay(dist);
        updateLastSeen(loc.updated_at || loc.timestamp || null);
    } catch { /* ignore */ }
}

// ── GPS live tracking ─────────────────────────────────────────────────────────

function initGPSTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition(pos => {
        _gpsLastTick = Date.now(); // marque que le GPS appareil est actif
        currentLoc = [pos.coords.latitude, pos.coords.longitude];

        markerPet.setLatLng(currentLoc);
        distanceLine.setLatLngs([homeLocation, currentLoc]);

        const group = L.featureGroup([markerHome, markerPet]);
        map.fitBounds(group.getBounds().pad(0.4));

        const dist      = Math.round(map.distance(currentLoc, homeLocation));
        const isOutside = dist > safeRadius;

        updateDistanceDisplay(dist);
        updateLastSeen(null);
        if (pos.coords.accuracy) updateAccuracy(pos.coords.accuracy);

        if (isOutside) {
            triggerVisualAlert(dist);
        } else {
            alertActive = false;
        }

        // Save to DB every 30 seconds
        const now = Date.now();
        if (now - lastSaveTick > 30000) {
            lastSaveTick = now;
            saveLocation(currentLoc, isOutside, dist);
        }
    }, err => {
        console.error('GPS error:', err);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

async function saveLocation(loc, isOutside, distance) {
    // ≥10m depuis la dernière sauvegarde → en mouvement ; sinon au repos
    const isMoving = _lastSavedLoc === null || map.distance(loc, _lastSavedLoc) >= 10;
    _lastSavedLoc  = [...loc];
    try {
        await fetch('api/location.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                latitude:   loc[0],
                longitude:  loc[1],
                is_outside: isOutside ? 1 : 0,
                is_moving:  isMoving ? 1 : 0,
                distance,
                pet_name:   petName(),
            }),
        });
    } catch { /* ignore */ }
}

// ── Vérification immédiate après changement de zone ──────────────────────────

function checkZoneAlert() {
    const dist = Math.round(map.distance(currentLoc, homeLocation));
    updateDistanceDisplay(dist);
    alertActive = false; // reset pour que l'alerte puisse re-déclencher
    if (dist > safeRadius) triggerVisualAlert(dist);
}

// ── Alert modal ───────────────────────────────────────────────────────────────

function triggerVisualAlert(distance) {
    if (alertActive) return;
    const name = petName();
    document.getElementById('modal-text').textContent =
        `אזהרה! ${name} יצא/ה מהרדיוס המותר. המרחק הנוכחי: ${distance} מטרים מהבית.`;
    document.getElementById('alert-modal').classList.add('open');
    alertActive = true;
}

function closeAlertModal() {
    document.getElementById('alert-modal').classList.remove('open');
}

// ── Zone editor ───────────────────────────────────────────────────────────────

let _savedHome   = null;
let _savedRadius = null;

function openZoneEditor() {
    _savedHome   = [...homeLocation];
    _savedRadius = safeRadius;

    document.getElementById('zone-addr-input').value       = '';
    document.getElementById('zone-addr-results').innerHTML = '';
    document.getElementById('zone-step-center').style.display = 'block';
    document.getElementById('zone-step-radius').style.display = 'none';
    document.getElementById('zone-editor').style.display   = 'block';
    document.getElementById('btn-set-home').style.display  = 'none';
}

let _zoneAddrDebounce = null;
function onZoneAddrInput(val) {
    clearTimeout(_zoneAddrDebounce);
    if (val.trim().length < 2) {
        document.getElementById('zone-addr-results').innerHTML = '';
        return;
    }
    _zoneAddrDebounce = setTimeout(searchZoneAddress, 350);
}

async function searchZoneAddress() {
    const q = document.getElementById('zone-addr-input').value.trim();
    if (!q) return;
    const btn = document.getElementById('btn-zone-addr-search');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled  = true;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}&countrycodes=il`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'he' } });
        const data = await res.json();
        renderZoneAddressResults(data);
    } catch {
        document.getElementById('zone-addr-results').innerHTML = '<p style="color:#e74c3c;font-size:0.85rem;">שגיאת רשת</p>';
    } finally {
        btn.innerHTML = '<i class="fas fa-search"></i>';
        btn.disabled  = false;
    }
}

function renderZoneAddressResults(results) {
    const el = document.getElementById('zone-addr-results');
    el.innerHTML = '';
    if (results.length === 0) {
        el.innerHTML = '<p style="color:#aaa;font-size:0.85rem;text-align:center;">לא נמצאו תוצאות</p>';
        return;
    }
    results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'addr-result-item';
        const addr = r.address;
        const label = addr
            ? [addr.house_number, addr.road, addr.suburb, addr.city || addr.town || addr.village].filter(Boolean).join(', ')
            : r.display_name.split(',').slice(0, 5).join(',');
        div.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#2a9d8f;margin-left:6px;"></i>${label}`;
        div.addEventListener('click', () => applyZoneCenter(+r.lat, +r.lon, label));
        el.appendChild(div);
    });
}

function setZoneFromGPS() {
    // watchPosition tourne déjà — on réutilise la position qu'il a fournie
    if (_gpsLastTick > 0) {
        applyZoneCenter(currentLoc[0], currentLoc[1], 'מיקום GPS הנוכחי');
        return;
    }
    // Fallback : watchPosition n'a pas encore de fix → tentative directe basse précision
    if (!navigator.geolocation) { alert('GPS לא זמין במכשיר זה'); return; }
    const btn = document.getElementById('btn-zone-gps');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מאתר...';
    btn.disabled  = true;
    navigator.geolocation.getCurrentPosition(
        pos => {
            btn.innerHTML = '<i class="fas fa-crosshairs"></i> השתמש במקום הנוכחי';
            btn.disabled  = false;
            applyZoneCenter(pos.coords.latitude, pos.coords.longitude, 'מיקום GPS הנוכחי');
        },
        () => {
            btn.innerHTML = '<i class="fas fa-crosshairs"></i> השתמש במקום הנוכחי';
            btn.disabled  = false;
            alert('GPS לא זמין — השתמש בחיפוש כתובת');
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
}

function applyZoneCenter(lat, lng, label) {
    homeLocation = [lat, lng];
    markerHome.setLatLng(homeLocation);
    safeCircle.setLatLng(homeLocation);
    distanceLine.setLatLngs([homeLocation, currentLoc]);
    map.setView(homeLocation, 15);

    document.getElementById('zone-center-label').innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + label;
    document.getElementById('zone-step-center').style.display = 'none';
    document.getElementById('zone-step-radius').style.display = 'block';

    const slider = document.getElementById('radius-slider');
    slider.value = safeRadius;
    document.getElementById('radius-display').textContent = safeRadius;
    safeCircle.setRadius(safeRadius);
}

function onRadiusChange(val) {
    safeRadius = parseInt(val);
    document.getElementById('radius-display').textContent = val;
    safeCircle.setRadius(safeRadius);
}

async function confirmNewZone() {
    distanceLine.setLatLngs([homeLocation, currentLoc]);
    checkZoneAlert();
    document.getElementById('zone-editor').style.display  = 'none';
    document.getElementById('btn-set-home').style.display = '';
    document.getElementById('btn-set-home').disabled      = true;
    document.getElementById('btn-set-home').innerHTML     = '<i class="fas fa-spinner fa-spin"></i> שומר...';
    try {
        const res  = await fetch('api/safetyzone.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ center_lat: homeLocation[0], center_lng: homeLocation[1], radius_meters: safeRadius }),
        });
        const data = await res.json();
        if (!data.success) alert('שגיאה בשמירה: ' + (data.error || 'שגיאה לא ידועה'));
    } catch {
        alert('שגיאת רשת — לא ניתן לשמור.');
    } finally {
        document.getElementById('btn-set-home').disabled  = false;
        document.getElementById('btn-set-home').innerHTML = '<i class="fas fa-home"></i> יצירת אזור בטוח חדש';
        detectActiveFavorite();
    }
}

function cancelNewZone() {
    homeLocation = [..._savedHome];
    safeRadius   = _savedRadius;
    markerHome.setLatLng(homeLocation);
    safeCircle.setLatLng(homeLocation);
    safeCircle.setRadius(safeRadius);
    distanceLine.setLatLngs([homeLocation, currentLoc]);
    document.getElementById('zone-editor').style.display  = 'none';
    document.getElementById('btn-set-home').style.display = '';
}

function navigateToDog() {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${homeLocation[0]},${homeLocation[1]}&destination=${currentLoc[0]},${currentLoc[1]}&travelmode=walking`;
    window.open(url, '_blank');
}

// ── Favorite zones ────────────────────────────────────────────────────────────

let _favs = [];
let _activeFavId = null;

function detectActiveFavorite() {
    const match = _favs.find(f =>
        Math.abs(+f.center_lat    - homeLocation[0]) < 0.0002 &&
        Math.abs(+f.center_lng    - homeLocation[1]) < 0.0002 &&
        Math.abs(+f.radius_meters - safeRadius)      <= 10
    );
    _activeFavId = match ? +match.id_favorite : null;
    renderFavorites(_favs);
}

async function loadFavorites() {
    try {
        const res = await fetch('api/safetyzone_favorites.php');
        if (!res.ok) return;
        _favs = await res.json();
        detectActiveFavorite();
    } catch { /* ignore */ }
}

function renderFavorites(favs) {
    const el = document.getElementById('favorites-list');
    if (!el) return;
    if (favs.length === 0) {
        el.innerHTML = '<p style="color:#aaa; font-size:0.88rem; text-align:center; padding:10px 0;">אין אזורים שמורים עדיין</p>';
        return;
    }
    el.innerHTML = favs.map(f => {
        const isActive = +f.id_favorite === +_activeFavId;
        return `
        <div class="fav-item">
            <div>
                <div class="fav-item-name"><i class="fas fa-map-marker-alt" style="color:#f4a261; margin-left:6px;"></i>${f.name}</div>
                <div class="fav-item-meta">רדיוס: ${f.radius_meters} מ' · ${new Date(f.created_at).toLocaleDateString('he-IL')}</div>
            </div>
            <div class="fav-item-actions">
                <button class="btn-fav-apply" onclick="applyFavorite(${f.id_favorite}, ${f.center_lat}, ${f.center_lng}, ${f.radius_meters})"
                    ${isActive ? 'disabled style="opacity:0.45; cursor:default;"' : ''}>
                    <i class="fas fa-check"></i> ${isActive ? 'פעיל' : 'החל'}
                </button>
                <button class="btn-fav-delete" onclick="deleteFavorite(${f.id_favorite}, this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function openAddFavorite() {
    document.getElementById('add-fav-form').style.display = 'block';
    document.getElementById('btn-add-fav').style.display  = 'none';
    document.getElementById('fav-name-input').focus();
}

function closeAddFavorite() {
    document.getElementById('add-fav-form').style.display = 'none';
    document.getElementById('btn-add-fav').style.display  = '';
    document.getElementById('fav-name-input').value = '';
}

async function saveFavorite() {
    const name = document.getElementById('fav-name-input').value.trim();
    if (!name) { document.getElementById('fav-name-input').focus(); return; }
    try {
        const res = await fetch('api/safetyzone_favorites.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, center_lat: homeLocation[0], center_lng: homeLocation[1], radius_meters: safeRadius }),
        });
        if (!res.ok) return;
        closeAddFavorite();
        loadFavorites();
    } catch { /* ignore */ }
}

async function applyFavorite(id, lat, lng, radius) {
    homeLocation  = [+lat, +lng];
    safeRadius    = +radius;
    _activeFavId  = +id;
    markerHome.setLatLng(homeLocation);
    safeCircle.setLatLng(homeLocation);
    safeCircle.setRadius(safeRadius);
    distanceLine.setLatLngs([homeLocation, currentLoc]);
    const group = L.featureGroup([markerHome, markerPet]);
    map.fitBounds(group.getBounds().pad(0.4));
    renderFavorites(_favs);
    checkZoneAlert();
    // Sauvegarde en DB pour persister après rechargement
    try {
        await fetch('api/safetyzone.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ center_lat: homeLocation[0], center_lng: homeLocation[1], radius_meters: safeRadius }),
        });
    } catch { /* ignore */ }
}

async function deleteFavorite(id, btn) {
    btn.disabled = true;
    try {
        await fetch('api/safetyzone_favorites.php', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_favorite: id }),
        });
        loadFavorites();
    } catch { btn.disabled = false; }
}

// ── Manual location ───────────────────────────────────────────────────────────

function openManualLocation() {
    document.getElementById('manual-loc-panel').style.display = 'block';
    document.getElementById('btn-manual-loc').style.display   = 'none';
    document.getElementById('manual-addr-input').focus();
}

function closeManualLocation() {
    document.getElementById('manual-loc-panel').style.display = 'none';
    document.getElementById('btn-manual-loc').style.display   = '';
    document.getElementById('manual-addr-input').value        = '';
    document.getElementById('manual-addr-results').innerHTML  = '';
}

async function searchManualAddress() {
    const q = document.getElementById('manual-addr-input').value.trim();
    if (!q) return;
    const btn = document.getElementById('btn-addr-search');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled  = true;

    try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=he`, {
            headers: { 'Accept-Language': 'he' }
        });
        const data = await res.json();
        renderAddressResults(data);
    } catch {
        document.getElementById('manual-addr-results').innerHTML =
            '<p style="color:#e74c3c; font-size:0.85rem;">שגיאת רשת, נסה שוב</p>';
    } finally {
        btn.innerHTML = '<i class="fas fa-search"></i>';
        btn.disabled  = false;
    }
}

function renderAddressResults(results) {
    const el = document.getElementById('manual-addr-results');
    el.innerHTML = '';
    if (results.length === 0) {
        el.innerHTML = '<p style="color:#aaa; font-size:0.85rem; text-align:center; padding:8px 0;">לא נמצאו תוצאות</p>';
        return;
    }
    results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'addr-result-item';
        div.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#6c8ebf; margin-left:6px;"></i>${r.display_name.split(',').slice(0, 4).join(',')}`;
        div.addEventListener('click', () => setManualLocation(r.lat, r.lon));
        el.appendChild(div);
    });
}

async function setManualLocation(lat, lng, displayName) {
    currentLoc = [+lat, +lng];
    markerPet.setLatLng(currentLoc);
    markerPet.setIcon(buildPetIcon());
    distanceLine.setLatLngs([homeLocation, currentLoc]);

    const group = L.featureGroup([markerHome, markerPet]);
    map.fitBounds(group.getBounds().pad(0.4));

    const dist     = Math.round(map.distance(currentLoc, homeLocation));
    const isOutside = dist > safeRadius;
    updateDistanceDisplay(dist);
    updateLastSeen(null);

    closeManualLocation();

    // Sauvegarde dans la DB
    await saveLocation(currentLoc, isOutside, dist);
    loadHistory();
}

// ── History & Today's Route ───────────────────────────────────────────────────

let _routePolyline = null;

async function loadHistory() {
    try {
        const res = await fetch('api/location_history.php');
        if (!res.ok) return;
        const data = await res.json();
        renderTodayRoute(data.today  || []);
        renderHistoryTable(data.recent || []);
    } catch { /* ignore */ }
}

function renderTodayRoute(points) {
    if (_routePolyline) { map.removeLayer(_routePolyline); _routePolyline = null; }
    if (points.length < 2) return;
    _routePolyline = L.polyline(
        points.map(p => [+p.latitude, +p.longitude]),
        { color: '#2a9d8f', weight: 4, opacity: 0.7 }
    ).addTo(map);
}

function renderHistoryTable(rows) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:18px;">אין נתונים</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((r, i) => `
        <tr>
            <td>${new Date(r.recorded_at).toLocaleString('he-IL')}</td>
            <td id="addr-${i}" data-lat="${r.latitude}" data-lng="${r.longitude}">${(+r.latitude).toFixed(5)}, ${(+r.longitude).toFixed(5)}</td>
            <td>${+r.is_outside
                ? '<span style="color:#e74c3c">⚠️ מחוץ לאזור</span>'
                : '<span style="color:#2a9d8f">✅ בתוך האזור</span>'}
                &nbsp;·&nbsp;${+r.is_moving ? 'בתנועה' : 'עצור'}</td>
        </tr>`
    ).join('');

    rows.forEach((r, i) => reverseGeocode(r.latitude, r.longitude, i));
}

async function reverseGeocode(lat, lng, index) {
    await new Promise(r => setTimeout(r, index * 1200));
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
            { headers: { 'Accept-Language': 'he' } }
        );
        if (!res.ok) return;
        const data = await res.json();
        const el = document.getElementById(`addr-${index}`);
        if (el && data.display_name) {
            el.textContent = data.display_name.split(',').slice(0, 3).join(',').trim();
        }
    } catch { /* ignore */ }
}

// ── Real-time polling (every 15 s) ────────────────────────────────────────────

function startLocationPolling() {
    setInterval(async () => {
        // Si le GPS appareil a fourni une position dans les 30 dernières secondes, ne pas écraser
        if (Date.now() - _gpsLastTick < 30000) return;
        try {
            const res = await fetch('api/location.php');
            if (!res.ok) return;
            const loc = await res.json();
            if (!loc.latitude || !loc.longitude) return;

            currentLoc = [+loc.latitude, +loc.longitude];
            markerPet.setLatLng(currentLoc);
            distanceLine.setLatLngs([homeLocation, currentLoc]);

            const dist = Math.round(map.distance(currentLoc, homeLocation));
            updateDistanceDisplay(dist);
            updateLastSeen(loc.updated_at || loc.timestamp || null);

            if (dist > safeRadius) triggerVisualAlert(dist);
            else alertActive = false;
        } catch { /* ignore */ }
    }, 15000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

Promise.all([loadSafetyZone(), loadLastLocation()]).then(() => {
    initGPSTracking();
    startLocationPolling();
    loadHistory();
    loadFavorites();
    setInterval(loadHistory, 30 * 60 * 1000); // rafraîchit le tableau toutes les 30 min
});
