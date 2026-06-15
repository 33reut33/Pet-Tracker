<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();
$pet_id   = get_pet_id($db, $owner_id);

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $stmt = $db->prepare('SELECT photo_url FROM pet WHERE id_pet = ? AND id_owner = ?');
    $stmt->execute([$pet_id, $owner_id]);
    $old = $stmt->fetchColumn();
    if ($old && file_exists(__DIR__ . '/../' . $old)) {
        @unlink(__DIR__ . '/../' . $old);
    }
    $stmt = $db->prepare('UPDATE pet SET photo_url = NULL WHERE id_pet = ? AND id_owner = ?');
    $stmt->execute([$pet_id, $owner_id]);
    json_out(['success' => true]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}

if (empty($_FILES['photo'])) {
    json_out(['error' => 'Aucun fichier reçu'], 400);
}

$file    = $_FILES['photo'];
$allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$maxSize = 5 * 1024 * 1024; // 5 MB

if ($file['error'] !== UPLOAD_ERR_OK) {
    json_out(['error' => 'Erreur upload : ' . $file['error']], 400);
}
if (!in_array($file['type'], $allowed)) {
    json_out(['error' => 'Format non autorisé (jpg/png/webp/gif)'], 400);
}
if ($file['size'] > $maxSize) {
    json_out(['error' => 'Fichier trop grand (max 5 Mo)'], 400);
}

$uploadDir = __DIR__ . '/../uploads/pets/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = 'pet_' . $pet_id . '_' . time() . '.' . strtolower($ext);
$dest     = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    json_out(['error' => 'Impossible de sauvegarder le fichier'], 500);
}

$url = 'uploads/pets/' . $filename;

// Supprimer l'ancienne photo si elle existe
$stmt = $db->prepare('SELECT photo_url FROM pet WHERE id_pet = ? AND id_owner = ?');
$stmt->execute([$pet_id, $owner_id]);
$old = $stmt->fetchColumn();
if ($old && file_exists(__DIR__ . '/../' . $old)) {
    @unlink(__DIR__ . '/../' . $old);
}

$stmt = $db->prepare('UPDATE pet SET photo_url = ? WHERE id_pet = ? AND id_owner = ?');
$stmt->execute([$url, $pet_id, $owner_id]);

json_out(['success' => true, 'photo_url' => $url]);
