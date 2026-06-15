<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}

try {

// Current status — last recorded point
$stmt = $db->prepare('
    SELECT latitude, longitude, is_moving, is_outside, recorded_at
    FROM location_history WHERE id_pet = ? ORDER BY recorded_at DESC LIMIT 1
');
$stmt->execute([$pet_id]);
$current = $stmt->fetch() ?: [
    'latitude'    => 32.0514,
    'longitude'   => 34.7603,
    'is_moving'   => 0,
    'is_outside'  => 0,
    'recorded_at' => null,
];

// Today's points — for distance + active/inactive time
$stmt = $db->prepare('
    SELECT latitude, longitude, is_moving
    FROM location_history
    WHERE id_pet = ? AND DATE(recorded_at) = CURDATE()
    ORDER BY recorded_at ASC
');
$stmt->execute([$pet_id]);
$points = $stmt->fetchAll();

$dist    = 0.0;
$active  = 0;
$inactive = 0;
for ($i = 0; $i < count($points); $i++) {
    $p = $points[$i];
    (int)$p['is_moving'] ? $active++ : $inactive++;
    if ($i > 0) {
        $pr   = $points[$i - 1];
        $dist += haversine((float)$pr['latitude'], (float)$pr['longitude'],
                           (float)$p['latitude'],  (float)$p['longitude']);
    }
}

// Hourly breakdown (0–23, gaps filled with 0)
$stmt = $db->prepare('
    SELECT HOUR(recorded_at) AS h, COUNT(*) AS total, SUM(is_moving) AS moving
    FROM location_history
    WHERE id_pet = ? AND DATE(recorded_at) = CURDATE()
    GROUP BY HOUR(recorded_at)
');
$stmt->execute([$pet_id]);
$hourly = array_fill(0, 24, ['total' => 0, 'moving' => 0]);
foreach ($stmt->fetchAll() as $row) {
    $hourly[(int)$row['h']] = ['total' => (int)$row['total'], 'moving' => (int)$row['moving']];
}

// 7-day history (gaps filled)
$stmt = $db->prepare('
    SELECT DATE(recorded_at) AS day, COUNT(*) AS total, SUM(is_moving) AS moving
    FROM location_history
    WHERE id_pet = ? AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(recorded_at)
    ORDER BY day ASC
');
$stmt->execute([$pet_id]);
$raw = [];
foreach ($stmt->fetchAll() as $row) { $raw[$row['day']] = $row; }

$weekly = [];
for ($i = 6; $i >= 0; $i--) {
    $day = date('Y-m-d', strtotime("-$i days"));
    $r   = $raw[$day] ?? ['total' => 0, 'moving' => 0];
    $weekly[] = ['day' => $day, 'total' => (int)$r['total'], 'moving' => (int)$r['moving']];
}

json_out([
    'status' => $current,
    'today'  => [
        'distance_meters'  => round($dist),
        'active_seconds'   => $active   * 15,
        'inactive_seconds' => $inactive * 15,
    ],
    'hourly' => $hourly,
    'weekly' => $weekly,
]);

} catch (Exception $e) {
    // Table location_history absente ou autre erreur DB
    $empty = array_fill(0, 24, ['total' => 0, 'moving' => 0]);
    $weekly = [];
    for ($i = 6; $i >= 0; $i--) {
        $weekly[] = ['day' => date('Y-m-d', strtotime("-$i days")), 'total' => 0, 'moving' => 0];
    }
    json_out([
        'status' => ['latitude' => 32.0514, 'longitude' => 34.7603, 'is_moving' => 0, 'is_outside' => 0, 'recorded_at' => null],
        'today'  => ['distance_meters' => 0, 'active_seconds' => 0, 'inactive_seconds' => 0],
        'hourly' => $empty,
        'weekly' => $weekly,
        '_error' => $e->getMessage(),
    ]);
}

function haversine($lat1, $lon1, $lat2, $lon2) {
    $R    = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a    = sin($dLat / 2) ** 2
          + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}
