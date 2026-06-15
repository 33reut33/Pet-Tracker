function updateSidebarPet(pet) {
    const el = document.getElementById('sidebar-pet-name');
    if (!el || !pet) return;
    const w = pet.weight ? ' · ' + parseFloat(pet.weight).toFixed(1) + ' ק"ג' : '';
    el.textContent = '🐾 ' + pet.name + w;
    el.classList.add('visible');
}
window.updateSidebarPet = updateSidebarPet;

(async function checkAuth() {
    const PUBLIC_PAGES = ['login.html', 'signup.html'];
    const page = location.pathname.split('/').pop() || 'index.html';

    if (PUBLIC_PAGES.includes(page)) return;

    // Masque tout le contenu pendant la vérification
    document.documentElement.style.visibility = 'hidden';

    try {
        const res  = await fetch('api/auth_check.php');
        const data = await res.json();

        if (!data.authenticated) {
            window.location.replace('login.html');
            return;
        }

        window.currentOwner = data.owner;
        window.currentPet   = data.selected_pet;

        const greetEl = document.getElementById('greeting-name');
        if (greetEl && data.selected_pet) {
            greetEl.textContent = data.selected_pet.name + ' מחכה לך!';
        }

        const petNameEl = document.getElementById('sidebar-pet-name');
        if (petNameEl && data.selected_pet) {
            updateSidebarPet(data.selected_pet);
        }

        document.dispatchEvent(new CustomEvent('auth:ready', {
            detail: { owner: data.owner, pet: data.selected_pet }
        }));

    } catch {
        // En local (file://), on ignore et on affiche quand même
    }

    // Affiche le contenu seulement une fois l'auth confirmée
    document.documentElement.style.visibility = 'visible';
})();
