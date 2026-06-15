<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // ORDER BY id_zone DESC pour toujours récupérer la ligne la plus récente
    $stmt = $db->prepare('SELECT * FROM safetyzone WHERE id_pet = ? ORDER BY id_zone DESC LIMIT 1');
    $stmt->execute([$pet_id]);
    $zone = $stmt->fetch();
    json_out($zone ?: ['center_lat' => 32.0514, 'center_lng' => 34.7603, 'radius_meters' => 100]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data   = json_decode(file_get_contents('php://input'), true) ?? [];
    $lat    = (float) ($data['center_lat']    ?? 0);
    $lng    = (float) ($data['center_lng']    ?? 0);
    $radius = (int)   ($data['radius_meters'] ?? 100);

    if (!$lat || !$lng) json_out(['error' => 'קואורדינטות חסרות'], 400);

    try {
        $stmt = $db->prepare('
            INSERT INTO safetyzone (id_pet, center_lat, center_lng, radius_meters)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE center_lat=VALUES(center_lat), center_lng=VALUES(center_lng), radius_meters=VALUES(radius_meters)
        ');
        $stmt->execute([$pet_id, $lat, $lng, $radius]);
        json_out(['success' => true]);
    } catch (Exception $e) {
        json_out(['error' => 'שגיאה בשמירה: ' . $e->getMessage()], 500);
    }
}

json_out(['error' => 'Méthode non autorisée'], 405);
