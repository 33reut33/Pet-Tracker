<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $db->prepare('SELECT * FROM healthlog WHERE id_pet = ? ORDER BY date_given DESC');
        $stmt->execute([$pet_id]);
        json_out($stmt->fetchAll());
    } catch (Exception $e) {
        json_out(['error' => 'שגיאה: ' . $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    // ── Action : toggle rappel ────────────────────────────────────────
    if (($data['action'] ?? '') === 'reminder') {
        $id_health    = (int) ($data['id_health']    ?? 0);
        $reminder_set = (int) ($data['reminder_set'] ?? 1);
        if (!$id_health) json_out(['error' => 'מזהה חסר'], 400);

        // La colonne reminder_set peut ne pas exister encore — on ignore l'erreur
        try {
            $stmt = $db->prepare('UPDATE healthlog SET reminder_set = ? WHERE id_health = ? AND id_pet = ?');
            $stmt->execute([$reminder_set, $id_health, $pet_id]);
        } catch (Exception $e) { /* colonne absente — on continue */ }

        if ($reminder_set) {
            try {
                $stmt = $db->prepare('SELECT vaccine_type, expiry_date FROM healthlog WHERE id_health = ? AND id_pet = ?');
                $stmt->execute([$id_health, $pet_id]);
                $vax = $stmt->fetch();
                if ($vax && $vax['expiry_date']) {
                    $reminderDate = date('d/m/Y', strtotime($vax['expiry_date'] . ' -15 days'));
                    $msg = "תזכורת: חיסון \"{$vax['vaccine_type']}\" יפוג בקרוב — יש לחדש לפני {$reminderDate}";
                    $stmt2 = $db->prepare('INSERT INTO alert (id_pet, alert_type, message) VALUES (?, "vaccine_reminder", ?)');
                    $stmt2->execute([$pet_id, $msg]);
                }
            } catch (Exception $e) { /* ignore */ }
        }
        json_out(['success' => true]);
    }

    // ── Ajout d'un vaccin ─────────────────────────────────────────────
    $vaccine_type = trim($data['vaccine_type'] ?? '');
    $date_given   = trim($data['date_given']   ?? '');
    $notes        = !empty($data['notes'])    ? trim($data['notes'])    : null;
    $vet_name     = !empty($data['vet_name']) ? trim($data['vet_name']) : null;

    if (!$vaccine_type) json_out(['error' => 'נא להזין סוג חיסון'], 400);
    if (!$date_given)   json_out(['error' => 'נא לבחור תאריך מתן'], 400);

    if (!empty($data['expiry_date'])) {
        $expiry_date = trim($data['expiry_date']);
    } else {
        $d = new DateTime($date_given);
        $d->modify('+1 year');
        $expiry_date = $d->format('Y-m-d');
    }

    // Essai avec vet_name — fallback sans si la colonne n'existe pas encore
    try {
        $stmt = $db->prepare(
            'INSERT INTO healthlog (id_pet, vaccine_type, date_given, expiry_date, notes, vet_name)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$pet_id, $vaccine_type, $date_given, $expiry_date, $notes, $vet_name]);
    } catch (Exception $e) {
        try {
            $stmt = $db->prepare(
                'INSERT INTO healthlog (id_pet, vaccine_type, date_given, expiry_date, notes)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$pet_id, $vaccine_type, $date_given, $expiry_date, $notes]);
        } catch (Exception $e2) {
            json_out(['error' => 'שגיאה בשמירה: ' . $e2->getMessage()], 500);
        }
    }
    json_out(['success' => true, 'id_health' => (int) $db->lastInsertId()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $data      = json_decode(file_get_contents('php://input'), true) ?? [];
    $id_health = (int) ($data['id_health'] ?? 0);
    if (!$id_health) json_out(['error' => 'מזהה חסר'], 400);
    try {
        $stmt = $db->prepare('DELETE FROM healthlog WHERE id_health = ? AND id_pet = ?');
        $stmt->execute([$id_health, $pet_id]);
        json_out(['success' => true]);
    } catch (Exception $e) {
        json_out(['error' => 'שגיאה במחיקה: ' . $e->getMessage()], 500);
    }
}

json_out(['error' => 'Méthode non autorisée'], 405);
