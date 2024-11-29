document.addEventListener("DOMContentLoaded", () => {
    const errorFilterCheckbox = document.getElementById("errorFilter");
    const requestsTableBody = document.querySelector("#requestsTable tbody");
    const requests = [];

    main(); // Entry point

    function main() {
        chrome.devtools.network.onRequestFinished.addListener((request) => {
            requests.push(request);
            const isError = request.response.status >= 400;
            const showOnlyErrors = errorFilterCheckbox.checked;

            if (!showOnlyErrors || isError) {
                addRequestToTable(request);
            }
        });

        // Handle filter checkbox change
        errorFilterCheckbox.addEventListener("change", updateTable);
    }

    function updateTable() {
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
        const details = {
            url: request.request.url,
            method: request.request.method,
            requestHeaders: request.request.headers,
            requestBody: request.request.postData
                ? request.request.postData.text
                : "",
            status: request.response.status,
            statusText: request.response.statusText,
            responseHeaders: request.response.headers,
            responseBody: "",
        };

        details.responseBody = await new Promise((resolve) => {
            request.getContent((content) => {
                resolve(content);
            });
        });

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
