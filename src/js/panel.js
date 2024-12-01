document.addEventListener("DOMContentLoaded", () => {
    let errorFilterCheckbox = null;
    let requestsTableBody = null;
    const requests = [];
    const requestTableTab = "requests";
    const settingsTab = "settings"

    const tabButtons = document.querySelectorAll(".tab-button");
    const tabPages = document.querySelectorAll(".tab-page");

    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activateTab(button.getAttribute("data-tab"));
        });
    });

    activateTab(requestTableTab); // Entrypoint

    function activateTab(tabId) {
        // Deactivate all tabs and buttons
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabPages.forEach((page) => page.classList.remove("active"));

        // Activate the selected tab and button
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add("active");
        const tabPage = document.getElementById(tabId);
        tabPage.classList.add("active");

        // Load content if not already loaded
        if (!tabPage.dataset.loaded) {
            loadTabContent(tabId);
        }
    }

    function loadTabContent(tabId) {
        const tabPage = document.getElementById(tabId);
        const url = chrome.runtime.getURL(`src/html/${tabId}.html`); // At runtime panel.js is in the root dir

        fetch(url)
            .then((response) => response.text())
            .then((html) => {
                tabPage.innerHTML = html;
                tabPage.dataset.loaded = "true"; // Mark as loaded

                if (tabId === requestTableTab) {
                    console.log("Initializing request table tab high...");
                    setTimeout(() => {
                        initRequestTableTab(tabId);
                    }, 0);
                    console.log("Initializing request table tab...");
                } else if (tabId === settingsTab) {
                    initSettingsTab();
                }
            })
            .catch((error) => {
                console.error(`Error loading ${tabId} content:`, error);
                tabPage.innerHTML = "<p>Error loading content.</p>";
            });
    }

    function initRequestTableTab() {
        // Init vars now we have new HTML loaded
        errorFilterCheckbox = document.getElementById("errorFilter");
        requestsTableBody = document.querySelector("#requestsTable tbody");

        const port = chrome.runtime.connect({ name: "devtools-panel" });

        // Request stored network requests
        port.postMessage({ action: "getNetworkRequests" });

        // Listen for messages from devtools.js
        port.onMessage.addListener((msg) => {
            if (msg.action === "networkRequests") {
                // Receive the stored network requests
                const storedRequests = msg.data;
                requests.push(...storedRequests);

                updateTable();

                setupNetworkListener();
            }
        });

        errorFilterCheckbox.addEventListener("change", updateTable);
    }

    function setupNetworkListener() {
        // Listen to new network requests
        chrome.devtools.network.onRequestFinished.addListener((request) => {
            console.log("New request:", request);
            requests.push(request);
            const isError = request.response.status >= 400;
            const showOnlyErrors = errorFilterCheckbox.checked;

            if (!showOnlyErrors || isError) {
                addRequestToTable(request);
            }
        });
    }


    function initSettingsTab() {
        const saveButton = document.getElementById("saveSettings");
        const resetButton = document.getElementById("resetSettings");

        saveButton.addEventListener("click", () => {
            saveSettings();
            alert("Settings saved.");
        });

        resetButton.addEventListener("click", () => {
            resetSettings();
        });

        loadSettings();
    }

    function resetSettings() {
        document.getElementById('resetSettings').addEventListener('click', () => {
            const form = document.getElementById('settingsForm');
            const defaultSettings = getDefaultSettings();

            for (const [key, value] of Object.entries(defaultSettings)) {
                const checkbox = form.elements[key];
                if (checkbox) {
                    checkbox.checked = value;
                }
            }
        });
    }

    function getDefaultSettings() {
        return {
            requestMethod: true,
            requestUrl: true,
            requestHeaders: false,
            requestBody: true,
            responseStatus: true,
            responseHeaders: false,
            responseBody: true,
        };
    }
    function saveSettings() {
        const form = document.getElementById("settingsForm");
        const formData = new FormData(form);
        const settings = {};

        for (const [key, value] of formData.entries()) {
            settings[key] = value === "on";
        }

        chrome.storage.local.set({ copySettings: settings }, () => {
            console.log("Settings saved.");
        });
    }

    function loadSettings() {
        const form = document.getElementById("settingsForm");
        chrome.storage.local.get(["copySettings"], (result) => {
            const settings = result.copySettings || getDefaultSettings();

            for (const [key, value] of Object.entries(settings)) {
                const checkbox = form.elements[key];
                if (checkbox) {
                    checkbox.checked = value;
                }
            }
        });
    }

    function updateTable() {
        console.log("Updating table...");
        requestsTableBody.innerHTML = "";
        const showOnlyErrors = errorFilterCheckbox.checked;

        requests.forEach((request) => {
            const isError = request.response.status >= 400;
            if (!showOnlyErrors || isError) {
                addRequestToTable(request);
            }
        });
    }

    function addRequestToTable(request) {
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${request.request.method}</td>
      <td>${request.request.url}</td>
      <td>${request.response.status}</td>
      <button class="copy-button" tabindex="0">Copy</button>
    `;

        const copyButton = row.querySelector(".copy-button");
        copyButton.addEventListener("mousedown", async (event) => {
            event.preventDefault();
            await copyRequestDetails(request);
            showTooltip(copyButton, "Network request copied to clipboard");
        });

        copyButton.addEventListener("keydown", async (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                await copyRequestDetails(request);
                showTooltip(copyButton, "Network request copied to clipboard");
            }
        });

        requestsTableBody.appendChild(row);
    }

    async function copyRequestDetails(request) {
        const settings = await new Promise((resolve) => {
            chrome.storage.local.get(['copySettings'], (result) => {
                resolve(result.copySettings || getDefaultSettings());
            });
        });

        const details = {};

        if (settings.url) details.url = request.request.url;
        if (settings.method) details.method = request.request.method;
        if (settings.requestHeaders) details.requestHeaders = request.request.headers;
        if (settings.requestBody && request.request.postData) {
            details.requestBody = request.request.postData.text;
        }
        if (settings.status) details.status = request.response.status;
        if (settings.statusText) details.statusText = request.response.statusText;
        if (settings.responseHeaders) details.responseHeaders = request.response.headers;

        if (settings.responseBody) {
            try {
                details.responseBody = await new Promise((resolve) => {
                    request.getContent((content) => {
                        resolve(content);
                    });
                });
            } catch (err) {
                console.error("Failed to retrieve response body: ", err);
            }
        }

        request.getContent((content, encoding) => {
            details.responseBody = content;

            const textToCopy = JSON.stringify(details, null, 2);
            copyTextToClipboard(textToCopy);
        });
    }

    function copyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Prevent scrolling to the bottom
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "1px";
        textArea.style.height = "1px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (!successful) {
                throw new Error('Copy command was unsuccessful');
            }
        } catch (err) {
            console.error('Failed to copy text', err);
        }
        document.body.removeChild(textArea);
    }

    function showTooltip(element, message) {
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.textContent = message;

        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.top - 30}px`;
        tooltip.style.left = `${rect.left}px`;

        document.body.appendChild(tooltip);

        setTimeout(() => {
            tooltip.remove();
        }, 2000);
    }
});
