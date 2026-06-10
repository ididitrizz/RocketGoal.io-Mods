const script = document.createElement('script');
script.src = chrome.runtime.getURL('injector.js');
script.onload = function() { this.remove(); };
script.onerror = function() { this.remove(); };
if (document.documentElement) {
    document.documentElement.insertBefore(script, document.documentElement.firstChild);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        document.documentElement.insertBefore(script, document.documentElement.firstChild);
    });
}
