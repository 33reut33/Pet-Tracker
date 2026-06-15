<?php
require_once 'config.php';
session_destroy();
json_out(['success' => true]);
