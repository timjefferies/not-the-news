<?php
// Set the cookie lifetime to 30 days (in seconds)
$cookieLifetime = 30 * 24 * 60 * 60;

// Set the session cookie parameters
session_set_cookie_params($cookieLifetime);
session_start();

// Handle the login form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = strtolower($_POST['username']); // Convert username to lowercase
    $password = $_POST['password'];

    // Load the configuration file
    $config = require 'config/config.php';

    // Check if the credentials match the configuration
    if ($username === $config['username'] && $password === $config['password']) {
        // Successful login
        $_SESSION['loggedin'] = true;
        header("Location: index.php");
        exit;
    } else {
        // Invalid credentials
        echo "Invalid username or password.";
        header("Location: login.html");
        exit;
    }
} else {
    // Check if the user is logged in
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        // Redirect to the login page
        header("Location: login.html");
        exit;
    }
}
?>
<?
error_reporting(E_ALL);
ini_set('display_errors', 1);
?>


<?php include 'data/final_feed.html'; ?>

<?php
$action = $_GET['action'] ?? '';

if ($action === 'save') {
    $data = $_POST['data'];
    file_put_contents('data/localstorage.json', $data);
    exit;
} elseif ($action === 'restore') {
    $data = file_get_contents('data/localstorage.json');
    echo $data;
    exit;
}
?>

