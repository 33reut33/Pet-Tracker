<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare('SELECT * FROM safe_zone_favorites WHERE id_pet = ? ORDER BY created_at DESC');
    $stmt->execute([$pet_id]);
    json_out($stmt->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data   = json_decode(file_get_contents('php://input'), true) ?? [];
    $name   = trim($data['name'] ?? '');
    $lat    = (float) ($data['center_lat']    ?? 0);
    $lng    = (float) ($data['center_lng']    ?? 0);
    $radius = (int)   ($data['radius_meters'] ?? 100);
    if (!$name || !$lat || !$lng) json_out(['error' => 'נתונים חסרים'], 400);
    $stmt = $db->prepare('INSERT INTO safe_zone_favorites (id_pet, name, center_lat, center_lng, radius_meters) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$pet_id, $name, $lat, $lng, $radius]);
    json_out(['success' => true, 'id_favorite' => (int) $db->lastInsertId()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $stmt = $db->prepare('DELETE FROM safe_zone_favorites WHERE id_favorite = ? AND id_pet = ?');
    $stmt->execute([(int) ($data['id_favorite'] ?? 0), $pet_id]);
    json_out(['success' => true]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
