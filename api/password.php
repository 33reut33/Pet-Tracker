<?php
require_once 'config.php';
$owner_id = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Méthode non autorisée'], 405);

$data        = json_decode(file_get_contents('php://input'), true) ?? [];
$old_pw      = $data['old_password'] ?? '';
$new_pw      = $data['new_password'] ?? '';
$confirm_pw  = $data['confirm_password'] ?? '';

if (!$old_pw || !$new_pw || !$confirm_pw) json_out(['error' => 'כל השדות הם חובה'], 400);
if (strlen($new_pw) < 8)                  json_out(['error' => 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים'], 400);
if ($new_pw !== $confirm_pw)               json_out(['error' => 'הסיסמאות החדשות אינן תואמות'], 400);

$db   = getDB();
$stmt = $db->prepare('SELECT password_hash FROM owner WHERE id_owner = ?');
$stmt->execute([$owner_id]);
$row  = $stmt->fetch();

if (!$row || !password_verify($old_pw, $row['password_hash'])) {
    json_out(['error' => 'הסיסמה הנוכחית שגויה'], 401);
}

$new_hash = password_hash($new_pw, PASSWORD_BCRYPT);
$stmt     = $db->prepare('UPDATE owner SET password_hash=? WHERE id_owner=?');
$stmt->execute([$new_hash, $owner_id]);
json_out(['success' => true]);
