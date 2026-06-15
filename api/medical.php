<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $db->prepare(
            'SELECT * FROM medical_records WHERE id_pet = ? ORDER BY date_start DESC, created_at DESC'
        );
        $stmt->execute([$pet_id]);
        json_out($stmt->fetchAll());
    } catch (Exception $e) {
        json_out(['error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    // ── Action : toggle rappel visite ────────────────────────────────
    if (($data['action'] ?? '') === 'reminder') {
        $id_record    = (int) ($data['id_record']    ?? 0);
        $reminder_set = (int) ($data['reminder_set'] ?? 1);
        $days_before  = max(1, (int) ($data['days_before'] ?? 1));
        if (!$id_record) json_out(['error' => 'מזהה חסר'], 400);

        // Met à jour reminder_set (ignoré si la colonne n'existe pas encore)
        try {
            $db->prepare('UPDATE medical_records SET reminder_set = ? WHERE id_record = ? AND id_pet = ?')
               ->execute([$reminder_set, $id_record, $pet_id]);
        } catch (Exception $e) { /* colonne absente — on continue */ }

        // Crée l'alerte si on active le rappel
        if ($reminder_set) {
            try {
                $stmt = $db->prepare(
                    'SELECT title, date_start, vet_name FROM medical_records WHERE id_record = ? AND id_pet = ?'
                );
                $stmt->execute([$id_record, $pet_id]);
                $rec = $stmt->fetch();
                if ($rec) {
                    $visitDate    = date('d/m/Y', strtotime($rec['date_start']));
                    $vet          = $rec['vet_name'] ? " אצל {$rec['vet_name']}" : '';
                    $msg          = "תזכורת: ביקור וטרינר \"{$rec['title']}\"{$vet} — תאריך: {$visitDate}";
                    $db->prepare('INSERT INTO alert (id_pet, alert_type, message) VALUES (?, "visit_reminder", ?)')
                       ->execute([$pet_id, $msg]);
                }
            } catch (Exception $e) { /* ignore */ }
        }
        json_out(['success' => true]);
    }

    // ── Ajout d'un enregistrement médical ────────────────────────────
    $record_type = trim($data['record_type'] ?? 'visit');
    $title       = trim($data['title']       ?? '');
    $date_start  = trim($data['date_start']  ?? '');
    $date_end    = !empty($data['date_end'])   ? trim($data['date_end'])   : null;
    $vet_name    = !empty($data['vet_name'])   ? trim($data['vet_name'])   : null;
    $notes       = !empty($data['notes'])      ? trim($data['notes'])      : null;
    $weight_kg   = (isset($data['weight_kg']) && $data['weight_kg'] !== '')
                   ? (float)$data['weight_kg'] : null;

    if (!$title)      json_out(['error' => 'נא להזין כותרת'], 400);
    if (!$date_start) json_out(['error' => 'נא לבחור תאריך'], 400);

    try {
        $stmt = $db->prepare(
            'INSERT INTO medical_records
             (id_pet, record_type, title, date_start, date_end, vet_name, notes, weight_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $pet_id, $record_type, $title, $date_start,
            $date_end, $vet_name, $notes, $weight_kg,
        ]);

        // Sync pet.weight uniquement si cette entrée est la plus récente
        if ($record_type === 'weight' && $weight_kg !== null) {
            $stmtMax = $db->prepare(
                'SELECT MAX(date_start) FROM medical_records WHERE id_pet = ? AND record_type = "weight"'
            );
            $stmtMax->execute([$pet_id]);
            $maxDate = $stmtMax->fetchColumn();
            if ($date_start >= $maxDate) {
                $db->prepare('UPDATE pet SET weight = ? WHERE id_pet = ?')
                   ->execute([$weight_kg, $pet_id]);
            }
        }

        json_out(['success' => true, 'id_record' => (int)$db->lastInsertId()]);
    } catch (Exception $e) {
        json_out(['error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $data      = json_decode(file_get_contents('php://input'), true) ?? [];
    $id_record = (int)($data['id_record'] ?? 0);
    if (!$id_record) json_out(['error' => 'מזהה חסר'], 400);
    try {
        $stmt = $db->prepare('DELETE FROM medical_records WHERE id_record = ? AND id_pet = ?');
        $stmt->execute([$id_record, $pet_id]);
        json_out(['success' => true]);
    } catch (Exception $e) {
        json_out(['error' => $e->getMessage()], 500);
    }
}

json_out(['error' => 'Méthode non autorisée'], 405);
