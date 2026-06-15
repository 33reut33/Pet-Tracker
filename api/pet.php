<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pet_id = get_pet_id($db, $owner_id);
    $stmt   = $db->prepare('SELECT * FROM pet WHERE id_pet = ? AND id_owner = ?');
    $stmt->execute([$pet_id, $owner_id]);
    $pet = $stmt->fetch();
    if (!$pet) json_out(['error' => 'Animal introuvable'], 404);
    json_out($pet);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $name = trim($data['name'] ?? '');
    if (!$name) json_out(['error' => 'שם החיה נדרש'], 400);

    $db->beginTransaction();
    try {
        $stmt = $db->prepare('INSERT INTO pet (id_owner, name, species, breed, birth_date, collar_id, vet_name, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $owner_id,
            $name,
            $data['species']    ?? 'dog',
            ($data['breed']      ?? null) ?: null,
            ($data['birth_date'] ?? null) ?: null,
            ($data['collar_id']  ?? null) ?: null,
            ($data['vet_name']   ?? null) ?: null,
            isset($data['weight']) && $data['weight'] !== '' ? (float) $data['weight'] : null,
        ]);
        $pet_id = (int) $db->lastInsertId();

        $db->commit();
        json_out(['success' => true, 'pet_id' => $pet_id]);
    } catch (Exception $e) {
        $db->rollBack();
        json_out(['error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data   = json_decode(file_get_contents('php://input'), true) ?? [];
    $pet_id = get_pet_id($db, $owner_id);
    $stmt   = $db->prepare('UPDATE pet SET name=?, species=?, breed=?, birth_date=?, collar_id=?, vet_name=?, weight=? WHERE id_pet=? AND id_owner=?');
    $stmt->execute([
        $data['name']       ?? null,
        $data['species']    ?? null,
        $data['breed']      ?? null,
        $data['birth_date'] ?? null,
        ($data['collar_id'] ?? null) ?: null,
        ($data['vet_name']  ?? null) ?: null,
        isset($data['weight']) && $data['weight'] !== '' ? (float) $data['weight'] : null,
        $pet_id,
        $owner_id,
    ]);
    json_out(['success' => true]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
