<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Méthode non autorisée'], 405);

$data     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (!$email || !$password) json_out(['error' => 'Email et mot de passe requis'], 400);

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM owner WHERE email = ?');
$stmt->execute([$email]);
$owner = $stmt->fetch();

if (!$owner || !password_verify($password, $owner['password_hash'])) {
    json_out(['error' => 'אימייל או סיסמה שגויים'], 401);
}

$_SESSION['owner_id']   = $owner['id_owner'];
$_SESSION['owner_name'] = $owner['first_name'];

$stmt = $db->prepare('SELECT * FROM pet WHERE id_owner = ? LIMIT 1');
$stmt->execute([$owner['id_owner']]);
$pet = $stmt->fetch();

json_out([
    'success' => true,
    'owner'   => [
        'id'         => $owner['id_owner'],
        'first_name' => $owner['first_name'],
        'last_name'  => $owner['last_name'],
        'email'      => $owner['email'],
    ],
    'pet' => $pet,
]);
