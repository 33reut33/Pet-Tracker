<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare('SELECT * FROM alert WHERE id_pet = ? ORDER BY created_at DESC LIMIT 20');
    $stmt->execute([$pet_id]);
    json_out($stmt->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $stmt = $db->prepare('DELETE FROM alert WHERE id_alert = ? AND id_pet = ?');
    $stmt->execute([(int) ($data['id_alert'] ?? 0), $pet_id]);
    json_out(['success' => true]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
