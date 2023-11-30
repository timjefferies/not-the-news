        // Function to save Local Storage data to a file
        function saveLocalStorageToFile() {
            // Capture Local Storage data
            var localStorageData = JSON.stringify(localStorage);

            // Send AJAX request to PHP script
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "index.php?action=save", true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    console.log("Local Storage data saved to file.");
                }
            };
            xhr.send("data=" + encodeURIComponent(localStorageData));
        }

        // Function to restore Local Storage data from a file
        function restoreLocalStorageFromFile() {
            // Send AJAX request to PHP script
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "index.php?action=restore", true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    var localStorageData = JSON.parse(xhr.responseText);
                    Object.keys(localStorageData).forEach(function (key) {
                        localStorage.setItem(key, localStorageData[key]);
                    });
                    console.log("Local Storage data restored from file.");
                }
            };
            xhr.send();
        }

        // Capture Local Storage changes and save to file
        window.addEventListener("storage", saveLocalStorageToFile);

        // Restore Local Storage from file on page load
        window.addEventListener("load", restoreLocalStorageFromFile);
