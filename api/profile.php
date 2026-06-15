<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();

/* ── GET : toutes les données du compte ─────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare('SELECT id_owner, first_name, last_name, email, phone, created_at FROM owner WHERE id_owner = ?');
    $stmt->execute([$owner_id]);
    $owner = $stmt->fetch();

    $pet_id_session = get_pet_id($db, $owner_id);
    $stmt = $db->prepare('SELECT * FROM pet WHERE id_pet = ? AND id_owner = ?');
    $stmt->execute([$pet_id_session, $owner_id]);
    $pet = $stmt->fetch();

    $pet_id = $pet ? (int)$pet['id_pet'] : null;

    $location = null;
    $zone     = null;
    $vaccines = [];
    $alerts   = [];

    if ($pet_id) {
        $stmt = $db->prepare('SELECT * FROM location WHERE id_pet = ?');
        $stmt->execute([$pet_id]);
        $location = $stmt->fetch();

        $stmt = $db->prepare('SELECT * FROM safetyzone WHERE id_pet = ?');
        $stmt->execute([$pet_id]);
        $zone = $stmt->fetch();

        $stmt = $db->prepare('SELECT * FROM healthlog WHERE id_pet = ? ORDER BY date_given DESC');
        $stmt->execute([$pet_id]);
        $vaccines = $stmt->fetchAll();

        $stmt = $db->prepare('SELECT * FROM alert WHERE id_pet = ? ORDER BY created_at DESC LIMIT 10');
        $stmt->execute([$pet_id]);
        $alerts = $stmt->fetchAll();
    }

    json_out([
        'owner'    => $owner,
        'pet'      => $pet,
        'location' => $location,
        'zone'     => $zone,
        'vaccines' => $vaccines,
        'alerts'   => $alerts,
    ]);
}

/* ── PUT : mise à jour des infos owner ──────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $first_name = trim($data['first_name'] ?? '');
    $last_name  = trim($data['last_name']  ?? '');
    $phone      = trim($data['phone']      ?? '');

    if (!$first_name || !$last_name) json_out(['error' => 'שם פרטי ושם משפחה הם שדות חובה'], 400);

    $stmt = $db->prepare('UPDATE owner SET first_name=?, last_name=?, phone=? WHERE id_owner=?');
    $stmt->execute([$first_name, $last_name, $phone ?: null, $owner_id]);
    json_out(['success' => true]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
