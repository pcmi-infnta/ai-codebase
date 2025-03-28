let conversationHistory = [];
let userIsScrolling = false;
let areFollowUpsHidden = false;
let userMessage = null;
let isResponseGenerating = false;
let isRepositoryLoaded = false;
let repositoryFiles = [];  // Will hold the codebase data

// Assets and caching information (kept for offline support)
const ASSETS_TO_CACHE = [
    '/',
    'index.html',
    'styles.css',
    'script.js',
    'manifest.json',
    'offline.html',
    'images/splash-android.png',
    'images/dev-logo.png', // updated logo image
    'images/dev-logo-192.png',
    'images/dev-logo-512.png',
    'images/avatars/dev-bot.png',
    'images/avatars/thinking.gif'
    // (Add any additional assets needed for a coding environment)
];

let assetsLoaded = 0;
const totalAssets = ASSETS_TO_CACHE.length;

const updateInstallProgress = () => {
  assetsLoaded++;
  const progress = (assetsLoaded / totalAssets) * 100;
  const progressBar = document.getElementById('install-progress-bar');
  if (progressBar) {
    progressBar.value = progress;
  }
};

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('ServiceWorker registration successful');
    } catch (err) {
      console.error('ServiceWorker registration failed: ', err);
    }
  });
}

// Offline Mode Handling
const handleOfflineMode = () => {
  window.addEventListener('online', () => {
    console.log('Back online');
    // Here you could sync any stored offline messages if needed.
  });

  window.addEventListener('offline', () => {
    console.log('Gone offline');
    showOfflineNotification();
  });
};

// Dummy offline notification if needed – you can customize this
const showOfflineNotification = () => {
  alert('You are currently offline. Some features may not be available.');
};

// Call on init
handleOfflineMode();


// Remove Firebase imports and training-data functions, using repository data instead!

// Load Repository Codebase Data
const loadRepositoryData = async () => {
  try {
    // This endpoint or file should return an array of objects.
    // Each object should have at least { fileName: string, content: string }.
    const res = await fetch('/repository/fileIndex.json');
    repositoryFiles = await res.json();
    isRepositoryLoaded = true;
    console.log('Repository data loaded successfully:', repositoryFiles);
  } catch (err) {
    console.error('Error loading repository data:', err);
  }
};
// Call immediately to load the repository data
loadRepositoryData();

// Real-time Date & Time (Philippines Time)
function getPhilippinesTime() {
    return new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour12: true,
        hour: "numeric",
        minute: "numeric",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// Local Storage Load Initial State (for conversation follow-ups hiding, etc.)
const loadInitialState = () => {
    areFollowUpsHidden = localStorage.getItem('hideFollowUps') === 'true';
};
loadInitialState();

// Update conversation history helper
const updateConversationHistory = (newMessage) => {
    conversationHistory.push(newMessage);
    if (conversationHistory.length > 5) {
        conversationHistory = conversationHistory.slice(-5);
    }
    localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));
};

// DOMContentLoaded event for install progress
document.addEventListener('DOMContentLoaded', () => {
  const progressBar = document.getElementById('install-progress');
  if (progressBar) {
    if (!localStorage.getItem('app-installed')) {
      progressBar.style.display = 'block';
      window.addEventListener('load', () => {
        setTimeout(() => {
          progressBar.style.display = 'none';
          localStorage.setItem('app-installed', 'true');
        }, 1000);
      });
    }
  }
});

// Add click listener for links (e.g., for GitHub or external links)
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    if (link.href && (link.href.startsWith('http'))) {
        // Open all external links in a new window
        window.open(link.href, '_blank');
        e.preventDefault();
    }
});

// Dynamically add additional style adjustments
const style = document.createElement('style');
style.textContent = `
    .external-link {
        pointer-events: auto !important;
        cursor: pointer !important;
    }
`;
document.head.appendChild(style);

// Load saved chats and conversation history from localStorage on page load
const loadDataFromLocalstorage = () => {
    const savedChats = localStorage.getItem("saved-chats");
    const savedHistory = localStorage.getItem("conversation-history");
    const isLightMode = (localStorage.getItem("themeColor") === "light_mode");

    areFollowUpsHidden = false;
    localStorage.removeItem('hideFollowUps');

    if (savedHistory) {
        conversationHistory = JSON.parse(savedHistory);
        if (conversationHistory.length > 5) {
            conversationHistory = conversationHistory.slice(-5);
            localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));
        }
    }

    const chatContainer = document.querySelector(".chat-list");
    if(savedChats && chatContainer) {
        chatContainer.innerHTML = savedChats;
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
    }
};
loadDataFromLocalstorage();

// Create Message Element Helper
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);

    const messageHTML = content;
    div.innerHTML = messageHTML;
    return div;
};

// Instead of church-specific suggestions, we define programming-focused follow-ups.
// (These could be dynamically generated, here is one simple static mapping.)
const customInitialFollowUps = {
    "How do I debug this code?": [
        "Show me a code snippet that fails.",
        "Have you checked error logs?",
        "What error message did you get?",
        "Try using console.log() and share the output."
    ],
    "Can you optimize this function?": [
        "What’s the performance bottleneck?",
        "Have you profiled this part of your code?",
        "Would rewriting in a different language help?",
        "Could you share more context?"
    ]
};

// Display Suggestions Helper (Programming style)
const displaySuggestions = async (messageDiv, aiResponse) => {
    if (isResponseGenerating) return;
    const existingSuggestions = messageDiv.querySelector(".suggestions-container");
    if (existingSuggestions) existingSuggestions.remove();

    let suggestions = [];
    if (customInitialFollowUps.hasOwnProperty(userMessage)) {
        suggestions = customInitialFollowUps[userMessage];
    } else {
        // Call the API for generating follow-up questions
        const suggestionsPrompt = `Based on the programming context of the following assistant response:
"${aiResponse}",
generate exactly 4 natural follow-up questions that are:
1. Directly related to debugging, improving, or understanding the code.
2. Short, simple, and straightforward.
Return only the questions, separated by "|".`;

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: suggestionsPrompt }]
                    }]
                })
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            suggestions = data.candidates[0].content.parts[0].text.split("|");
        } catch (error) {
            console.error("Error generating suggestions:", error);
            return;
        }
    }

    const suggestionsContainer = document.createElement("div");
    suggestionsContainer.classList.add("suggestions-container");
    suggestionsContainer.innerHTML = `
        <div class="related-header">
            <span class="related-icon material-symbols-rounded">code</span>
            <span class="related-text">Related</span>
        </div>
        <div class="suggestions-list">
            ${suggestions.map(suggestion => `
                <div class="suggestion-item">
                    <span class="suggestion-text">${suggestion.trim()}</span>
                    <span class="expand-icon">+</span>
                </div>
            `).join('')}
        </div>
    `;
    messageDiv.appendChild(suggestionsContainer);
    messageDiv.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
            const text = item.querySelector(".suggestion-text").textContent;
            document.querySelector(".typing-input").value = text;
            document.querySelector("#send-message-button").click();
        });
    });
};

// Typing effect for incoming messages
const showTypingEffect = (text, textElement, incomingMessageDiv) => {
    const words = text.split(' ');
    let currentWordIndex = 0;
    let displayedText = '';

    const existingSuggestions = incomingMessageDiv.querySelector(".suggestions-container");
    if (existingSuggestions) existingSuggestions.remove();

    const typingInterval = setInterval(() => {
        displayedText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex++];
        // Format text if needed (for code blocks you may add pre/code styling)
        let formattedText = displayedText;
        textElement.innerHTML = formattedText;
        const icon = incomingMessageDiv.querySelector(".icon");
        if (icon) icon.classList.add("hide");

        if (currentWordIndex === words.length) {
            clearInterval(typingInterval);
            isResponseGenerating = false;
            if (icon) icon.classList.remove("hide");
            localStorage.setItem("saved-chats", document.querySelector(".chat-list").innerHTML);

            if (!areFollowUpsHidden && text.trim() !== "I'm sorry, I can't answer that.") {
                setTimeout(() => {
                    displaySuggestions(incomingMessageDiv, text);
                }, 500);
            }
        }
        if (!userIsScrolling) {
            document.querySelector(".chat-list").scrollTo(0, document.querySelector(".chat-list").scrollHeight);
        }
    }, 75);
};

// Detect scrolling of chat container
const chatContainer = document.querySelector(".chat-list");
if (chatContainer) {
    chatContainer.addEventListener('scroll', () => {
        userIsScrolling = true;
        clearTimeout(chatContainer.scrollTimeout);
        chatContainer.scrollTimeout = setTimeout(() => {
            userIsScrolling = false;
        }, 1000);
    }, { passive: true });
}

// Create Message with optional media (if we ever want to show screenshots or videos)
const createMessageWithMedia = (text, mediaPath) => {
    const isVideo = mediaPath.endsWith('.mp4');
    const mediaElement = isVideo
      ? `<video class="response-media" autoplay loop muted playsinline>
           <source src="${mediaPath}" type="video/mp4">
         </video>`
      : `<img class="response-media" src="${mediaPath}" alt="Media content">`;

    const messageContent = `<div class="message-content">
        <div class="header-row">
            <div class="avatar-container">
                <img class="avatar default-avatar" src="images/avatars/dev-bot.png" alt="Bot avatar">
                <img class="avatar thinking-avatar" src="images/avatars/thinking.gif" alt="Thinking avatar">
            </div>
            <div class="answer-indicator">
                Answer
                <img class="verified-badge" src="images/avatars/verified-badge.svg" alt="Verified" style="height: 16px; width: 16px; margin-left: 4px;">
            </div>
        </div>
        <div class="message-container">
            ${mediaElement}
            <p class="text">${text}</p>
            <div class="message-actions">
                <span class="icon material-symbols-rounded">content_copy</span>
                <span class="menu-icon icon material-symbols-rounded" style="display: none;">prompt_suggestion</span>
            </div>
        </div>
    </div>`;
    const messageElement = createMessageElement(messageContent, "incoming");

    const messageActions = messageElement.querySelector('.message-actions');
    if (messageActions) {
        const copyButton = messageActions.querySelector('.icon');
        const menuButton = messageActions.querySelector('.menu-icon');
        copyButton.addEventListener('click', () => copyMessage(copyButton));
        menuButton.addEventListener('click', () => toggleFollowUps(menuButton));
    }
    return messageElement;
};

// Copy message helper
const copyMessage = (copyButton) => {
    const messageText = copyButton.closest('.message').querySelector('.text').innerText;
    navigator.clipboard.writeText(messageText)
      .then(() => {
        console.log('Message copied to clipboard.');
      })
      .catch(err => {
        console.error('Error copying text: ', err);
      });
};

// Toggle follow-ups display helper
const toggleFollowUps = (menuButton) => {
    const suggestions = menuButton.closest('.message').querySelector('.suggestions-container');
    if (suggestions) {
        suggestions.style.display = suggestions.style.display === 'none' ? 'block' : 'none';
    }
};

// Custom error messages based on error type
const getCustomErrorMessage = (error) => {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        return "Connection lost! Please check your internet connection and try again.";
    }
    return error.message;
};

// Inappropriate content detection can be adjusted as needed; for now, we simply block empty queries.
const isInappropriateContent = (message) => {
    return !message || message.trim().length === 0;
};

// API configuration (please replace the API_KEY with your valid key)
const API_KEY = "AIzaSyC0N559LhkMH1GqrvF1Pg7cpkMmaHMZgZg";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

// Generate API Response by sending conversation history and repository context
const generateAPIResponse = async (incomingMessageDiv) => {
    const textElement = incomingMessageDiv.querySelector(".text");

    if (!isRepositoryLoaded) {
        textElement.textContent = "Still loading repository data, please wait...";
        return;
    }

    if (isInappropriateContent(userMessage)) {
        textElement.textContent = "I'm sorry, I can't answer that.";
        isResponseGenerating = false;
        incomingMessageDiv.classList.remove("loading");
        updateConversationHistory({
            role: "assistant",
            content: "I'm sorry, I can't answer that."
        });
        localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));
        return;
    }

    // Build conversation messages from history
    const messages = conversationHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
    }));

    // Build repository summary: list each file with a snippet of its content.
    const repositorySummary = repositoryFiles.map(file => {
      let snippet = file.content.substring(0, 300).trim();
      if (file.content.length > 300) snippet += " ...";
      return `Filename: ${file.fileName}\n----------------\n${snippet}`;
    }).join('\n\n');

    // Build context prompt explaining that the assistant is focused on code analysis.
    const contextPrefix = `
Current Date and Time in Philippines: ${getPhilippinesTime()}

You are a programming assistant. You have access to the following repository codebase:

${repositorySummary}

Based on the user's query and conversation history below, provide a concise explanation, debugging advice, or code suggestion.
Please use very simple language and include code snippets if necessary.
`;

    // Assemble full conversation payload
    const payloadText = contextPrefix + "\n\n" +
      messages.map(m => m.parts[0].text).join('\n\n') +
      "\n\nUser Query: " + userMessage;

    // Start API call – using a generative language model API
    try {
        isResponseGenerating = true;
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: payloadText }]
                }]
            })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;
        updateConversationHistory({
            role: "assistant",
            content: aiText
        });
        localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));
        showTypingEffect(aiText, textElement, incomingMessageDiv);
    } catch (error) {
        console.error("Error generating API response:", error);
        textElement.textContent = getCustomErrorMessage(error);
        isResponseGenerating = false;
    }
};

// =====================
// Event Listeners Setup
// =====================

// Typing form submit event
const typingForm = document.querySelector(".typing-form");
if(typingForm) {
    typingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (isResponseGenerating) return;
        const inputElement = typingForm.querySelector(".typing-input");
        userMessage = inputElement.value.trim();
        if (!userMessage) return;

        // Append user message to chat container
        const chatContainer = document.querySelector(".chat-list");
        const userMessageElem = createMessageElement(`<p class="text">${userMessage}</p>`, "outgoing");
        chatContainer.appendChild(userMessageElem);
        inputElement.value = "";
        chatContainer.scrollTo(0, chatContainer.scrollHeight);

        // Create container for AI response message
        const incomingMessageDiv = createMessageElement(`<p class="text"></p>`, "incoming", "loading");
        chatContainer.appendChild(incomingMessageDiv);
        chatContainer.scrollTo(0, chatContainer.scrollHeight);

        generateAPIResponse(incomingMessageDiv);
    });
}

