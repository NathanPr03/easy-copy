// At runtime devtools.js is in the root dir, hence the seemingly strange paths
chrome.devtools.panels.create('Easy Copy', 'icons/icon128.png', 'src/html/panel.html', () => {
    console.log('user switched to this panel');
});
