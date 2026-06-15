<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Récupère la position la plus récente pour cet animal
    $stmt = $db->prepare('SELECT * FROM location WHERE id_pet = ? ORDER BY id_location DESC LIMIT 1');
    $stmt->execute([$pet_id]);
    $loc = $stmt->fetch();
    json_out($loc ?: ['latitude' => 32.0514, 'longitude' => 34.7603, 'is_outside' => 0, 'is_moving' => 1]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data       = json_decode(file_get_contents('php://input'), true) ?? [];
    $lat        = (float) ($data['latitude']   ?? 0);
    $lng        = (float) ($data['longitude']  ?? 0);
    $is_outside = (int)   ($data['is_outside'] ?? 0);
    $is_moving  = (int)   ($data['is_moving']  ?? 1);

    // UPDATE si une ligne existe déjà, sinon INSERT
    $stmt = $db->prepare('UPDATE location SET latitude=?, longitude=?, is_outside=?, is_moving=? WHERE id_pet=?');
    $stmt->execute([$lat, $lng, $is_outside, $is_moving, $pet_id]);

    if ($stmt->rowCount() === 0) {
        $stmt = $db->prepare('INSERT INTO location (id_pet, latitude, longitude, is_outside, is_moving) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$pet_id, $lat, $lng, $is_outside, $is_moving]);
    }

    // Historique : UPDATE l'heure si la dernière position est à moins de 200m, sinon INSERT
    try {
        $stmt = $db->prepare('
            SELECT id_history,
                (6371000 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(latitude)) *
                    COS(RADIANS(longitude) - RADIANS(?)) +
                    SIN(RADIANS(?)) * SIN(RADIANS(latitude))
                )) AS dist
            FROM location_history WHERE id_pet = ? ORDER BY recorded_at DESC LIMIT 1
        ');
        $stmt->execute([$lat, $lng, $lat, $pet_id]);
        $last = $stmt->fetch();

        if ($last && $last['dist'] <= 200) {
            $stmt = $db->prepare('UPDATE location_history SET recorded_at = NOW(), is_outside = ?, is_moving = ? WHERE id_history = ?');
            $stmt->execute([$is_outside, $is_moving, $last['id_history']]);
        } else {
            $stmt = $db->prepare('INSERT INTO location_history (id_pet, latitude, longitude, is_outside, is_moving) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$pet_id, $lat, $lng, $is_outside, $is_moving]);
        }
    } catch (Exception $e) { /* table location_history absente — ignore */ }

    if ($is_outside) {
        $dist = (int) ($data['distance'] ?? 0);
        $stmt = $db->prepare('SELECT name FROM pet WHERE id_pet = ?');
        $stmt->execute([$pet_id]);
        $pet_name = $stmt->fetchColumn() ?: 'החיה';
        $msg = "{$pet_name} יצא/ה מהרדיוס המותר. הוא/היא נמצא/ת כרגע {$dist} מטרים מהבית!";
        $stmt = $db->prepare('INSERT INTO alert (id_pet, alert_type, message) VALUES (?, "zone_exit", ?)');
        $stmt->execute([$pet_id, $msg]);
    }

    json_out(['success' => true]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
