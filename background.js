chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ textSelectorEnabled: false });
});

const OPENAI_API_KEY = "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";
const GOOGLE_FACT_CHECK_API_KEY = "AIzaSyBgjolRB8RJe-3cQWxJ8nuPtA3yJOFQP5g";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getApiKeys") {
        sendResponse({
            openaiApiKey: OPENAI_API_KEY,
            googleFactCheckApiKey: GOOGLE_FACT_CHECK_API_KEY
        });
    } else if (request.action === "toggleTextSelector") {
        chrome.storage.local.get("textSelectorEnabled", (data) => {
            const newState = !data.textSelectorEnabled;
            chrome.storage.local.set({ textSelectorEnabled: newState }, () => {
                sendResponse({ enabled: newState });
            });
        });
        return true;
    } else if (request.action === "getTextSelectorStatus") {
        chrome.storage.local.get("textSelectorEnabled", (data) => {
            sendResponse({ enabled: data.textSelectorEnabled });
        });
        return true;
    }
});
