<?php
require_once 'config.php';
$owner_id = require_auth();
$db       = getDB();

$stmt = $db->prepare('SELECT * FROM pet WHERE id_owner = ? ORDER BY created_at ASC');
$stmt->execute([$owner_id]);
json_out($stmt->fetchAll());
