<?php
require_once 'config.php';
$owner_id = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Méthode non autorisée'], 405);

$data   = json_decode(file_get_contents('php://input'), true) ?? [];
$pet_id = (int) ($data['pet_id'] ?? 0);

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM pet WHERE id_pet = ? AND id_owner = ?');
$stmt->execute([$pet_id, $owner_id]);
$pet  = $stmt->fetch();

if (!$pet) json_out(['error' => 'Animal introuvable'], 404);

$_SESSION['selected_pet_id'] = $pet_id;
json_out(['success' => true, 'pet' => $pet]);
