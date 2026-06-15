<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Méthode non autorisée'], 405);

$data = json_decode(file_get_contents('php://input'), true) ?? [];

$first_name = trim($data['first_name'] ?? '');
$last_name  = trim($data['last_name']  ?? '');
$email      = trim($data['email']      ?? '');
$password   = $data['password']        ?? '';
$phone      = trim($data['phone']      ?? '');

if (!$first_name || !$last_name || !$email || !$password) {
    json_out(['error' => 'חסרים שדות חובה'], 400);
}

// Support both new format (pets array) and old format (single pet fields)
$pets_data = $data['pets'] ?? [];
if (empty($pets_data) && !empty($data['pet_name'])) {
    $pets_data = [[
        'name'       => $data['pet_name'],
        'species'    => $data['species']    ?? 'dog',
        'breed'      => $data['breed']      ?? null,
        'birth_date' => $data['birth_date'] ?? null,
    ]];
}
if (empty($pets_data)) json_out(['error' => 'נדרשת לפחות חיה אחת'], 400);

$db   = getDB();
$stmt = $db->prepare('SELECT id_owner FROM owner WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) json_out(['error' => 'כתובת האימייל כבר רשומה במערכת'], 409);

$hash = password_hash($password, PASSWORD_BCRYPT);

$db->beginTransaction();
try {
    $stmt = $db->prepare('INSERT INTO owner (first_name, last_name, email, password_hash, phone) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$first_name, $last_name, $email, $hash, $phone ?: null]);
    $owner_id = (int) $db->lastInsertId();

    $stmtPet  = $db->prepare('INSERT INTO pet (id_owner, name, species, breed, birth_date, collar_id, vet_name, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtVax  = $db->prepare('INSERT INTO healthlog (id_pet, vaccine_type, date_given, expiry_date) VALUES (?, ?, ?, ?)');

    $first_pet_id = null;
    foreach ($pets_data as $p) {
        $name = trim($p['name'] ?? '');
        if (!$name) continue;
        $stmtPet->execute([
            $owner_id,
            $name,
            $p['species']    ?? 'dog',
            ($p['breed']      ?? null) ?: null,
            ($p['birth_date'] ?? null) ?: null,
            ($p['collar_id']  ?? null) ?: null,
            ($p['vet_name']   ?? null) ?: null,
            isset($p['weight']) && $p['weight'] !== '' ? (float) $p['weight'] : null,
        ]);
        $pet_id = (int) $db->lastInsertId();
        if ($first_pet_id === null) $first_pet_id = $pet_id;

        foreach (($p['vaccines'] ?? []) as $vax) {
            $vax_type   = trim($vax['vaccine_type'] ?? '');
            $date_given = trim($vax['date_given']   ?? '');
            if (!$vax_type || !$date_given) continue;
            if (!empty($vax['expiry_date'])) {
                $expiry = trim($vax['expiry_date']);
            } else {
                $d = new DateTime($date_given);
                $d->modify('+1 year');
                $expiry = $d->format('Y-m-d');
            }
            $stmtVax->execute([$pet_id, $vax_type, $date_given, $expiry]);
        }
    }

    $db->commit();

    $_SESSION['owner_id']   = $owner_id;
    $_SESSION['owner_name'] = $first_name;

    json_out(['success' => true, 'owner_id' => $owner_id, 'pet_id' => $first_pet_id]);
} catch (Exception $e) {
    $db->rollBack();
    json_out(['error' => 'שגיאה בהרשמה: ' . $e->getMessage()], 500);
}
