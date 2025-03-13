document.addEventListener("DOMContentLoaded", function () {
    let openaiApiKey = "";
    let googleFactCheckApiKey = "";
    
    
    chrome.runtime.sendMessage({ action: "getApiKeys" }, (response) => {
        openaiApiKey = response.openaiApiKey;
        googleFactCheckApiKey = response.googleFactCheckApiKey;
    });
    
    const toggleButton = document.getElementById("toggleTextSelector");
    const checkButton = document.getElementById("check");
    const outputDiv = document.getElementById("output");
    
    
    chrome.storage.local.get("textSelectorEnabled", (data) => {
        updateToggleButton(data.textSelectorEnabled || false);
    });
    
    
    toggleButton.addEventListener("click", function () {
        chrome.storage.local.get("textSelectorEnabled", (data) => {
            const newState = !data.textSelectorEnabled;
            chrome.storage.local.set({ textSelectorEnabled: newState }, () => {
                updateToggleButton(newState);
            });
        });
    });
    
    function updateToggleButton(isEnabled) {
        toggleButton.textContent = isEnabled ? "Text Selector: ON" : "Text Selector: OFF";
        document.getElementById("toggleStatus").textContent = "Text Selector is " + (isEnabled ? "ON" : "OFF");
    }
    
    
    checkButton.addEventListener("click", async function () {
        const inputText = document.getElementById("input").value.trim();
        if (!inputText) {
            outputDiv.textContent = "⚠️ Please enter some text.";
            outputDiv.style.color = "#FF0000";
            return;
        }
        
        outputDiv.textContent = "🔍 Checking news authenticity...";
        outputDiv.style.color = "#333";
        
        try {
            const result = await verifyNews(inputText);
            outputDiv.textContent = result;
            if (result.toLowerCase().includes("fake")) {
                outputDiv.style.color = "#FF0000";
            } else if (result.toLowerCase().includes("true")) {
                outputDiv.style.color = "#008000";
            } else {
                outputDiv.style.color = "#0000FF";
            }
        } catch (error) {
            console.error("Error checking news:", error);
            outputDiv.textContent = "Error checking news.";
            outputDiv.style.color = "#FF0000";
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
});
