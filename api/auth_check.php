<?php
require_once 'config.php';

if (empty($_SESSION['owner_id'])) {
    json_out(['authenticated' => false]);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id_owner, first_name, last_name, email FROM owner WHERE id_owner = ?');
$stmt->execute([$_SESSION['owner_id']]);
$owner = $stmt->fetch();

if (!$owner) {
    session_destroy();
    json_out(['authenticated' => false]);
}

// Retourne l'animal sélectionné, avec fallback sur le premier animal
$selected_pet = null;
if (!empty($_SESSION['selected_pet_id'])) {
    $stmt = $db->prepare('SELECT * FROM pet WHERE id_pet = ? AND id_owner = ?');
    $stmt->execute([$_SESSION['selected_pet_id'], $_SESSION['owner_id']]);
    $selected_pet = $stmt->fetch() ?: null;
}
if (!$selected_pet) {
    $stmt = $db->prepare('SELECT * FROM pet WHERE id_owner = ? ORDER BY id_pet LIMIT 1');
    $stmt->execute([$_SESSION['owner_id']]);
    $selected_pet = $stmt->fetch() ?: null;
    if ($selected_pet) $_SESSION['selected_pet_id'] = $selected_pet['id_pet'];
}

json_out([
    'authenticated' => true,
    'owner'         => $owner,
    'selected_pet'  => $selected_pet,
]);
