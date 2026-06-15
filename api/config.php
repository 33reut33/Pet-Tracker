<?php
session_start();

define('DB_HOST', 'localhost');
define('DB_NAME', 'elonha_pet_tracker');
define('DB_USER', 'elonha');
define('DB_PASS', 'uzoMPzYkfm');

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    }
    return $pdo;
}

function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function require_auth() {
    if (empty($_SESSION['owner_id'])) {
        json_out(['error' => 'Non authentifié'], 401);
    }
    return (int) $_SESSION['owner_id'];
}

function get_pet_id(PDO $db, int $owner_id): int {
    // Use selected pet from session if valid
    if (!empty($_SESSION['selected_pet_id'])) {
        $stmt = $db->prepare('SELECT id_pet FROM pet WHERE id_pet = ? AND id_owner = ?');
        $stmt->execute([$_SESSION['selected_pet_id'], $owner_id]);
        $row = $stmt->fetch();
        if ($row) return (int) $row['id_pet'];
    }
    // Fallback: first pet
    $stmt = $db->prepare('SELECT id_pet FROM pet WHERE id_owner = ? LIMIT 1');
    $stmt->execute([$owner_id]);
    $row = $stmt->fetch();
    if (!$row) json_out(['error' => 'Animal introuvable'], 404);
    return (int) $row['id_pet'];
}
