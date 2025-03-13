let openaiApiKey = "";
let googleFactCheckApiKey = "";


chrome.runtime.sendMessage({ action: "getApiKeys" }, (response) => {
    openaiApiKey = response.openaiApiKey;
    googleFactCheckApiKey = response.googleFactCheckApiKey;
});

let isTextSelectorEnabled = false;

chrome.storage.local.get("textSelectorEnabled", (data) => {
    isTextSelectorEnabled = data.textSelectorEnabled || false;
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.textSelectorEnabled) {
        isTextSelectorEnabled = changes.textSelectorEnabled.newValue;
    }
});

async function verifyNews(text) {
    
    let googleRating = "";
    const googleUrl = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(text)}&key=${googleFactCheckApiKey}`;
    try {
        const googleResponse = await fetch(googleUrl);
        if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            if (googleData.claims && googleData.claims.length > 0) {
                const firstClaim = googleData.claims[0];
                if (firstClaim.claimReview && firstClaim.claimReview.length > 0) {
                    googleRating = firstClaim.claimReview[0].textualRating || "";
                }
            }
        }
    } catch (error) {
        console.error("Error with Google Fact Check API:", error);
    }
    
    
    let prompt = `Given the news: "${text}"`;
    if (googleRating) {
        prompt += ` and additional information: "${googleRating}"`;
    }
    prompt += `, determine if this news is fake or real. Respond with either "Fake News Detected" or "News Detected as True" along with a brief explanation.`;
    
    const openaiUrl = "https://api.openai.com/v1/chat/completions";
    try {
        const openaiResponse = await fetch(openaiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a fact-checker. Evaluate the news and determine if it is fake or real without mentioning your source."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0
            })
        });
        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error("OpenAI API Error:", openaiResponse.status, errorText);
            throw new Error("Error with OpenAI API");
        }
        const openaiData = await openaiResponse.json();
        if (openaiData && openaiData.choices && openaiData.choices.length > 0) {
            return openaiData.choices[0].message.content;
        } else {
            throw new Error("Error: OpenAI API returned an empty result.");
        }
    } catch (error) {
        console.error("Error with OpenAI API:", error);
        throw error;
    }
}

function highlightSelection(result) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.textContent = selection.toString();
    span.title = result;
    
    if (result.toLowerCase().includes("fake")) {
        span.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
    } else if (result.toLowerCase().includes("true")) {
        span.style.backgroundColor = "rgba(0, 255, 0, 0.2)";
    } else {
        span.style.backgroundColor = "rgba(128, 128, 128, 0.3)";
    }
    span.style.padding = "2px 4px";
    span.style.borderRadius = "4px";
    
    range.deleteContents();
    range.insertNode(span);
}

document.addEventListener("mouseup", async function () {
    if (!isTextSelectorEnabled) return;
    
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText || selectedText.length < 5) return;
    
    try {
        const result = await verifyNews(selectedText);
        highlightSelection(result);
    } catch (error) {
        console.error("Error Processing Text:", error);
    }
});
