// At runtime devtools.js is in the root dir, hence the seemingly strange paths
chrome.devtools.panels.create('Easy Copy', 'icons/icon128.png', 'src/html/panel.html', () => {
    console.log('user switched to this panel');


    const networkRequests = [];

    chrome.devtools.network.onRequestFinished.addListener((request) => {
        console.log("Captured request:", request);
        networkRequests.push(request);
    });

    chrome.runtime.onConnect.addListener((port) => {
        console.assert(port.name === "devtools-panel");

        port.onMessage.addListener((msg) => {
            if (msg.action === "getNetworkRequests") {
                // Send the stored network requests to panel.js
                port.postMessage({ action: "networkRequests", data: networkRequests });
            }
        });
    });
});
