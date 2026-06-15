<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $db->prepare('SELECT * FROM location_history WHERE id_pet = ? ORDER BY recorded_at DESC LIMIT 10');
        $stmt->execute([$pet_id]);
        $recent = $stmt->fetchAll();

        $stmt = $db->prepare('SELECT latitude, longitude, recorded_at FROM location_history WHERE id_pet = ? AND DATE(recorded_at) = CURDATE() ORDER BY recorded_at ASC');
        $stmt->execute([$pet_id]);
        $today = $stmt->fetchAll();

        json_out(['recent' => $recent, 'today' => $today]);
    } catch (Exception $e) {
        json_out(['recent' => [], 'today' => []]);
    }
}

json_out(['error' => 'Méthode non autorisée'], 405);
