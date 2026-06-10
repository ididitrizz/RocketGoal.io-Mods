let recorderStreamId = null;
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.action === "START_SILENT_RECORD") {
        chrome.tabCapture.getMediaStreamId({ targetTabId: sender.tab.id }, (streamId) => {
            recorderStreamId = streamId;
            chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['USER_MEDIA'],
                justification: 'Recording match perspective gameplay chunks.'
            }).then(() => {
                chrome.runtime.sendMessage({ action: "INIT_RECORDING", streamId: streamId });
                sendResponse({ success: true });
            });
        });
        return true;
    }
    if (message.action === "STOP_SILENT_RECORD") {
        chrome.runtime.sendMessage({ action: "CEASE_RECORDING" });
        sendResponse({ success: true });
    }
});
