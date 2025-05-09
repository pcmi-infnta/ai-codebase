let userIsScrolling = false;
let areFollowUpsHidden = false;
let userMessage = null;
let isResponseGenerating = false;
let isDataLoaded = false; 
let displayedImages = new Set();
let assetsLoaded = 0;
let repositoryFiles = [];
let conversationHistory = JSON.parse(localStorage.getItem("conversation-history")) || [];

// Function to load the manifest and then load each file’s content
const loadRepositoryFiles = async () => {
  try {
    // Fetch the manifest file that lists all repository files
    const manifestResponse = await fetch('repository-manifest.json');
    if (!manifestResponse.ok) throw new Error('Failed to load repository-manifest.json');

    const manifestJSON = await manifestResponse.json();
    const files = manifestJSON.files;

    // Fetch each file’s content
    const fileFetchPromises = files.map(async (file) => {
      const response = await fetch(file.path);
      if (!response.ok) throw new Error(`Failed to load ${file.path}`);
      const content = await response.text();

      return {
        fileName: file.fileName,
        content: content
      };
    });

    repositoryFiles = await Promise.all(fileFetchPromises);
    console.log('Repository files loaded:', repositoryFiles);

    // Add this to mark data as loaded
    isDataLoaded = true;
  } catch (error) {
    console.error('Error loading repository files:', error);
  }
};
loadRepositoryFiles();


document.addEventListener('DOMContentLoaded', () => {
  const progressBar = document.getElementById('install-progress');
  if (progressBar) {  // Only add listener if element exists
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

/*

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('ServiceWorker registration successful');
    } catch (err) {
      console.error('ServiceWorker registration failed: ', err);
    }
  });
} */

const loadInitialState = () => {
    areFollowUpsHidden = localStorage.getItem('hideFollowUps') === 'true';
};
loadInitialState();

const updateConversationHistory = (newMessage) => {
    // Add the new message
    conversationHistory.push(newMessage);
    
    // Keep only the last 5 messages
    if (conversationHistory.length > 5) {
        conversationHistory = conversationHistory.slice(-5);
    }
    
    // Update localStorage
    localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));
};


document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    // Check if it's a Facebook link
    if (link.href && link.href.includes('facebook.com')) {
        e.preventDefault(); // Prevent default link behavior
        
        // For iOS
        if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
            window.location.href = `fb://profile/${getFacebookId(link.href)}`;
            
            // Fallback to opening in system browser if FB app isn't installed
            setTimeout(() => {
                window.location.href = link.href;
            }, 2000);
        } 
        // For Android
        else if (navigator.userAgent.match(/Android/i)) {
            window.location.href = `intent://${link.href.replace(/^https?:\/\//, '')}#Intent;package=com.facebook.katana;scheme=https;end`;
        }
        // Fallback for other platforms
        else {
            window.open(link.href, '_system');
        }
    }
});

// Helper function to extract Facebook ID from URL
const getFacebookId = (url) => {
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0];
};

// Add this style dynamically
const style = document.createElement('style');
style.textContent = `
    .facebook-link {
        pointer-events: auto !important;
        cursor: pointer !important;
    }
`;
document.head.appendChild(style);

// Real-time Date & Time
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

const getUserIP = async () => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error getting IP:', error);
        return 'unknown';
    }
};

const typingForm = document.querySelector(".typing-form");
const chatContainer = document.querySelector(".chat-list");
const suggestions = document.querySelectorAll(".suggestion");
const toggleThemeButton = document.querySelector("#theme-toggle-button");
const deleteChatButton = document.querySelector("#delete-chat-button");

// API configuration
const API_KEY = "<MY_API_KEY>"; // API key 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

// Load theme and chat data from local storage on page load
const loadDataFromLocalstorage = () => {
    const savedChats = localStorage.getItem("saved-chats");
    const savedHistory = localStorage.getItem("conversation-history");
    const isLightMode = (localStorage.getItem("themeColor") === "light_mode");

    // Reset the follow-ups hidden state when loading
    areFollowUpsHidden = false;
    localStorage.removeItem('hideFollowUps');

    // Load conversation history if exists
    if (savedHistory) {
        conversationHistory = JSON.parse(savedHistory);
        // Ensure only last 5 messages are kept
        if (conversationHistory.length > 5) {
            conversationHistory = conversationHistory.slice(-5);
            localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));
        }
    }

    chatContainer.innerHTML = savedChats || '';
    document.body.classList.toggle("hide-header", savedChats);

    chatContainer.scrollTo(0, chatContainer.scrollHeight);
}

const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);

    const isAdminPanel = window.location.pathname.includes('admin');

    let messageHTML;
    if (isAdminPanel) {
        const timestamp = new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
            weekday: "short"
        });

        messageHTML = `
      <div class="message-timestamp">${timestamp}</div>
      ${content}
    `;
    } else {
        messageHTML = content;
    }

    div.innerHTML = messageHTML;
    return div;
}

const customInitialFollowUps = {
    "What time does Sunday service starts?": [
        "What should I wear?",
        "What do I need to bring?",
        "Do you have parking space?",
        "Is there service pick-up every Sunday?"
    ],
    "Where is your church located?": [
        "What are your church's core beliefs?",
        "Tell me about your services",
        "Do you have online services or resources?",
        "Do you have any contact details?"
    ],
    "What is Intentional Discipleship?": [
        "Do I need to sign up to join?",
        "Is there any requirements?",
        "What time id usually ends?",
        "Are there any fees or cost involved?"
    ],
    "When is the next Youth Fellowship?": [
        "What activities do you have in Youth Fellowship?",
        "What age group can join?",
        "How long does it usually last?",
        "Do I need to bring anything?"
    ]
};

const displaySuggestions = async (messageDiv, aiResponse) => {
    if (isResponseGenerating) return;

    const existingSuggestions = messageDiv.querySelector(".suggestions-container");
    if (existingSuggestions) {
        existingSuggestions.remove();
    }

    let suggestions = [];
    if (customInitialFollowUps.hasOwnProperty(userMessage)) {
        // Use custom follow-ups for initial suggestions
        suggestions = customInitialFollowUps[userMessage];
    } else {
        // Follow-ups Suggestions Rules
        const suggestionsPrompt = `Based on the specific topic and context of your previous response: "${aiResponse}",
            generate exactly 4 concise follow-up questions that:
            1. Directly relate to the main technical topic just discussed
            2. Follow a logical progression of the developer’s workflow
            3. Help users explore deeper insights or additional aspects of the topic
            4. Stay within the professional context of software development and technical discussions
            5. Use clear, precise, and straightforward language.
            6. Adapt the suggestions to match the user's communication style and technical expertise. 

        ### IMPORTANT: Ensure the suggestions are brief, highly relevant, and professional.

            Additional rules:
            - Questions must be directly related to the previous technical response
            - Focus on actionable insights and practical aspects relevant to developers
            - Maintain conversation continuity within the software development domain
            - Avoid generic or unrelated topics
            - Use the developer knowledge base to enhance the quality and relevance of suggestions
            - Present questions in a logical and structured format for ease of understanding.

            Return only the questions, separated by |`;

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{
                            text: suggestionsPrompt
                        }]
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
        <span class="related-icon material-symbols-rounded">stacks</span>
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

    // Add click handlers for suggestions
    messageDiv.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
            const text = item.querySelector(".suggestion-text").textContent;
            document.querySelector(".typing-input").value = text;
            document.querySelector("#send-message-button").click();
        });
    });
};


// Show typing effect by displaying words one by one
const showTypingEffect = (text, textElement, incomingMessageDiv) => {
    const words = text.split(' ');
    let currentWordIndex = 0;
    let displayedText = '';

    const existingSuggestions = incomingMessageDiv.querySelector(".suggestions-container");
    if (existingSuggestions) {
        existingSuggestions.remove();
    }

    const typingInterval = setInterval(() => {
        displayedText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex++];

        if (currentWordIndex === words.length) {
            clearInterval(typingInterval);
            isResponseGenerating = false;
            incomingMessageDiv.querySelector(".icon").classList.remove("hide");
            localStorage.setItem("saved-chats", chatContainer.innerHTML);

            if (!areFollowUpsHidden && text.trim() !== "I'm sorry, I can't answer that.") {
                setTimeout(() => {
                    displaySuggestions(incomingMessageDiv, text);
                }, 500);
            } else {
                const menuButton = incomingMessageDiv.querySelector('.menu-icon');
                if (menuButton) {
                    menuButton.style.display = 'inline-flex';
                }
            }
        }

        if (!userIsScrolling) {
            chatContainer.scrollTo(0, chatContainer.scrollHeight);
        }
    }, 75);
}

// Event listener detect manual scrolling
chatContainer.addEventListener('scroll', () => {
    userIsScrolling = true;
    // Reset the flag after a short delay
    clearTimeout(chatContainer.scrollTimeout);
    chatContainer.scrollTimeout = setTimeout(() => {
        userIsScrolling = false;
    }, 1000);
}, {
    passive: true
});



const createMessageWithMedia = (text, mediaPath) => {
    const isVideo = mediaPath.endsWith('.mp4');
    const mediaElement = isVideo ?
        `<video class="response-image" autoplay loop muted playsinline>
       <source src="${mediaPath}" type="video/mp4">
     </video>` :
        `<img class="response-image" src="${mediaPath}" alt="Church media">`;

    const messageContent = `<div class="message-content">
    <div class="header-row">
      <div class="avatar-container">
        <img class="avatar default-avatar" src="images/avatars/pcmi-bot.png" alt="Bot avatar">
        <img class="avatar thinking-avatar" src="images/avatars/thinking.gif" alt="Thinking avatar">
      </div>
      <div class="answer-indicator">
        Answer
        <img class="verified-badge" src="images/avatars/verified-badge.svg" alt="Verified" style="height: 16px; width: 16px; margin-left: 4px; vertical-align: middle;">
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
}

const getCustomErrorMessage = (error) => {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        const offlineMessages = [
            "Hmm... looks like we lost connection. Please check your internet and try again! 🌐",
            "Oops! We can't seem to connect right now. Mind checking your internet connection? 📶",
            "Connection hiccup! Please make sure you're connected to the internet and try again. ⚡",
            "We're having trouble connecting to our servers. Could you check your internet connection? 🔄",
            "It seems the internet connection is taking a break. Please check your connection and try again! 🔌",
            "Unable to connect right now. Please check if you're online and try once more. 🌍",
            "Connection lost! A quick internet check might help us get back on track. 🔎",
            "We hit a small bump - please check your internet connection and give it another try! 🚀"
        ];
        return offlineMessages[Math.floor(Math.random() * offlineMessages.length)];
    }
    return error.message;
};

const isInappropriateContent = (message) => {
    const inappropriateKeywords = ["badword1", "badword2", "offensive phrase"];
    return inappropriateKeywords.some(keyword => message.toLowerCase().includes(keyword));
};

// Fetch response from the API based on user message
const generateAPIResponse = async (incomingMessageDiv) => {
    const textElement = incomingMessageDiv.querySelector(".text");

    if (!isDataLoaded) {
        textElement.textContent = "Still loading training data, please wait...";
        return;
    }

    // Check inappropriate content
    if (isInappropriateContent(userMessage)) {
        textElement.textContent = "I'm sorry, I can't answer that.";
        isResponseGenerating = false;
        incomingMessageDiv.classList.remove("loading");

        // Save to conversation history
        updateConversationHistory({
    role: "assistant",
    content: "I'm sorry, I can't answer that."
});
        localStorage.setItem("conversation-history", JSON.stringify(conversationHistory));

        return;
    }

    // Location/service related keywords 
    const isLocationQuery = userMessage.toLowerCase().includes('location') ||
        userMessage.toLowerCase().includes('locate') ||
        userMessage.toLowerCase().includes('located');

    const isYouthQuery = userMessage.toLowerCase().includes('youth') ||
        userMessage.toLowerCase().includes('fellowship') ||
        userMessage.toLowerCase().includes('young people');

    const isCellGroupQuery = userMessage.toLowerCase().includes('cell') ||
        userMessage.toLowerCase().includes('kamustahan') ||
        userMessage.toLowerCase().includes('online cellgroup');

    const isSundayServiceQuery = userMessage.toLowerCase().includes('sunday') ||
        userMessage.toLowerCase().includes('worship') ||
        userMessage.toLowerCase().includes('service time');

    const isDiscipleshipQuery = userMessage.toLowerCase().includes('discipleship') ||
        userMessage.toLowerCase().includes('disciple') ||
        userMessage.toLowerCase().includes('life class');
    const isPrayerWarriorQuery = userMessage.toLowerCase().includes('prayer warrior') ||
        userMessage.toLowerCase().includes('prayer warrior') ||
        userMessage.toLowerCase().includes('friday');
    // Create the conversation payload
    const messages = conversationHistory.map(msg => ({
        role: msg.role,
        parts: [{
            text: msg.content
        }]
    }));

    // Add current context and rules
    const contextPrefix = ` 
    Current Date and Time: ${getPhilippinesTime()} 
    You are now a programming assistant with complete access to the codebase. Below is the codebase loaded from the repository:

    ${repositoryFiles.map(file => 
      `Filename: 
      ${file.fileName}
      ${file.content.substring(0, 300)}${file.content.length > 300 ? '...' : ''} 
      -------------------------`
    ).join('\n\n')}

    Please provide the best answer related to the developer's question.
  `;

    const imageKeywords = {
        location: {
            keywords: ['location', 'located'],
            path: 'images/services/church-location.png'
        },
        youth: {
            keywords: ['youth fellowship', 'fellowship', , 'first sunday', 'yf'],
            path: 'images/services/youth-fellowship.jpg'
        },
        cellgroup: {
            keywords: ['cellgroup', 'kamustahan', 'cell group', 'cg'],
            path: 'images/services/cellgroup.jpg'
        },
        sundayService: {
            keywords: ['sunday', 'praise and worship', 'service time'],
            path: 'images/services/sunday-service.gif'
        },
        discipleship: {
            keywords: ['discipleship', 'id', 'life class'],
            path: 'images/services/discipleship.jpg'
        },
        prayerWarrior: {
            keywords: ['prayer warrior', 'friday'],
            path: 'images/services/prayer-warrior.jpg'
        }
    };

    // Function to check which image should be displayed
    const getImageType = (message) => {
        const lowercaseMessage = message.toLowerCase();
        for (const [type, data] of Object.entries(imageKeywords)) {
            if (data.keywords.some(keyword => lowercaseMessage.includes(keyword))) {
                return {
                    type,
                    path: data.path
                };
            }
        }
        return null;
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    ...messages,
                    {
                        role: "user",
                        parts: [{
                            text: contextPrefix + userMessage
                        }]
                    }
                ]
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        const apiResponse = data.candidates[0].content.parts[0].text;

        let finalResponse = apiResponse;
        if (userMessage.trim().toLowerCase() === "what is intentional discipleship?") {
            // Remove any trailing spaces or line breaks before adding signature
            finalResponse = finalResponse.trim() + " — It's all about Jesus!";
        

        try {
    const imageInfo = getImageType(userMessage);
    if (imageInfo && !displayedImages.has(imageInfo.type)) {
        displayedImages.add(imageInfo.type);
        const messageElement = createMessageWithMedia(finalResponse, imageInfo.path);
        incomingMessageDiv.replaceWith(messageElement);
        const newTextElement = messageElement.querySelector(".text");
        newTextElement.textContent = '';
        showTypingEffect(finalResponse, newTextElement, messageElement);
    } else {
        showTypingEffect(finalResponse, textElement, incomingMessageDiv);
    }

    updateConversationHistory({
        role: "assistant",
        content: apiResponse
    });

} catch (error) {
    isResponseGenerating = false;
    const customErrorMessage = getCustomErrorMessage(error);
    textElement.innerText = customErrorMessage;
    textElement.parentElement.closest(".message").classList.add("error");
} finally {
    incomingMessageDiv.classList.remove("loading");

    const answerIndicator = incomingMessageDiv.querySelector('.answer-indicator');
    if (answerIndicator) {
        answerIndicator.textContent = "Answer";
    }
}

// Show loading animation while waiting for API response
const showLoadingAnimation = () => {
    const html = `<div class="message-content">
                  <div class="header-row">
                    <div class="avatar-container">
                      <img class="avatar default-avatar" src="images/avatars/pcmi-bot.png" alt="Bot avatar">
                      <img class="avatar thinking-avatar" src="images/avatars/thinking.gif" alt="Thinking avatar">
                    </div>
                    <div class="answer-indicator">Thinking</div>
                  </div>
                  <div class="message-container">
                    <p class="text"></p>
                    <div class="loading-indicator">
                      <div class="loading-bar"></div>
                      <div class="loading-bar"></div>
                      <div class="loading-bar"></div>
                    </div>
                    <div class="message-actions">
                      <span class="icon material-symbols-rounded">content_copy</span>
                      <span class="menu-icon icon material-symbols-rounded" style="display: none;">prompt_suggestion</span>
                    </div>
                  </div>
                </div>`;
    const incomingMessageDiv = createMessageElement(html, "incoming", "loading");

    const messageActions = incomingMessageDiv.querySelector('.message-actions');
    if (messageActions) {
        const copyButton = messageActions.querySelector('.icon');
        const menuButton = messageActions.querySelector('.menu-icon');

        copyButton.addEventListener('click', () => copyMessage(copyButton));
        menuButton.addEventListener('click', () => toggleFollowUps(menuButton));
    }

    chatContainer.appendChild(incomingMessageDiv);
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
    generateAPIResponse(incomingMessageDiv);
}

// Copy message text to clipboard
const copyMessage = (copyButton) => {
    const messageContainer = copyButton.closest('.message-container');
    const messageText = messageContainer.querySelector(".text").innerText;

    navigator.clipboard.writeText(messageText).then(() => {
        copyButton.innerText = "done";
        setTimeout(() => copyButton.innerText = "content_copy", 1000); // Revert icon after 1 second
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

const toggleFollowUps = async (menuButton) => {
    const messageDiv = menuButton.closest('.message');
    const textElement = messageDiv.querySelector('.text');

    if (isResponseGenerating) return;

    try {

        const existingSuggestions = messageDiv.querySelector('.suggestions-container');
        if (existingSuggestions) {
            existingSuggestions.remove();
        }

        // Reset the hidden state when showing suggestions
        areFollowUpsHidden = false;
        localStorage.removeItem('hideFollowUps');

        menuButton.style.display = 'none';

        if (textElement && textElement.textContent) {
            await displaySuggestions(messageDiv, textElement.textContent);
        }

    } catch (error) {
        console.error('Error showing suggestions:', error);
        menuButton.style.display = 'inline-flex';
    }
};

window.copyMessage = copyMessage;
window.toggleFollowUps = toggleFollowUps;

const hideFollowUps = (suggestionsContainer) => {
    const messageDiv = suggestionsContainer.closest('.message');
    const menuButton = messageDiv.querySelector('.menu-icon');

    suggestionsContainer.classList.add('hiding');

    // Set global state to hide suggestions
    areFollowUpsHidden = true;
    localStorage.setItem('hideFollowUps', 'true');

    setTimeout(() => {
        suggestionsContainer.remove();
        if (menuButton) {
            menuButton.style.display = 'inline-flex';
        }

        // Show menu icons for all messages
        document.querySelectorAll('.message .menu-icon').forEach(icon => {
            icon.style.display = 'inline-flex';
        });
    }, 400);
};

// Handle sending outgoing chat messages
const handleOutgoingChat = () => {
    document.querySelectorAll(".suggestions-container").forEach(container => {
        container.remove();
    });

    userMessage = typingForm.querySelector(".typing-input").value.trim() || userMessage;
    if (!userMessage || isResponseGenerating) return;

    isResponseGenerating = true;

    // Add user message to conversation history
    updateConversationHistory({
    role: "user",
    content: userMessage
});

    // Keep the user message structure simple and inline
    const html = `<div class="message-content">
                <img class="avatar" src="images/avatars/user.gif" alt="User avatar">
                <div class="message-container">
                  <p class="text"></p>
                </div>
              </div>`;

    const outgoingMessageDiv = createMessageElement(html, "outgoing");
    outgoingMessageDiv.querySelector(".text").innerText = userMessage;
    chatContainer.appendChild(outgoingMessageDiv);

    typingForm.reset(); // Clear input field

    inputWrapper.classList.remove("expanded");
    actionButtons.classList.remove("hide");

    document.body.classList.add("hide-header");
    chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
    setTimeout(showLoadingAnimation, 500); // Show loading animation after a delay
}
const waveContainer = document.querySelector(".theme-wave-container");
const waveElement = document.querySelector(".theme-wave");

toggleThemeButton.addEventListener("click", () => {
    const isLightMode = document.body.classList.contains("light_mode");
    document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightMode ? "dark_mode" : "light_mode");
    toggleThemeButton.innerText = isLightMode ? "light_mode" : "dark_mode";
});

// Delete all chats from local storage when button is clicked
deleteChatButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all the chats?")) {
        displayedImages.clear(); // Reset tracked images
        localStorage.removeItem("saved-chats");
        localStorage.removeItem("conversation-history");
        chatContainer.innerHTML = "";
        document.body.classList.remove("hide-header");
        localStorage.removeItem("hideFollowUps");
        conversationHistory = [];
        areFollowUpsHidden = false;
        loadDataFromLocalstorage();
    }
});

// Set userMessage and handle outgoing chat when a suggestion is clicked
suggestions.forEach(suggestion => {
    suggestion.addEventListener("click", () => {
        userMessage = suggestion.querySelector(".text").innerText;
        handleOutgoingChat();
    });
});

// Prevent default form submission and handle outgoing chat
typingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOutgoingChat();
});

loadDataFromLocalstorage();

const inputWrapper = document.querySelector(".typing-form .input-wrapper");
const actionButtons = document.querySelector(".action-buttons");
const typingInput = document.querySelector(".typing-input");

typingInput.addEventListener("focus", () => {
    inputWrapper.classList.add("expanded");
    actionButtons.classList.add("hide");
});

typingInput.addEventListener("blur", () => {
    // Only collapse if there's no text
    if (typingInput.value.length === 0 && !isResponseGenerating) {
        inputWrapper.classList.remove("expanded");
        actionButtons.classList.remove("hide");
    }
});

typingInput.addEventListener("input", () => {
    // Keep expanded while typing
    if (typingInput.value.length > 0) {
        inputWrapper.classList.add("expanded");
        actionButtons.classList.add("hide");
    }
});

// Simplified event listeners
let windowHeight = window.innerHeight;
window.addEventListener('resize', () => {
    if (window.innerHeight > windowHeight) {
        if (typingInput.value.length === 0) {
            inputWrapper.classList.remove("expanded");
            actionButtons.classList.remove("hide");
        }
    }
    windowHeight = window.innerHeight;
}, {
    passive: true
});

window.addEventListener('popstate', (e) => {
    e.preventDefault();
    history.pushState(null, null, window.location.href);
});


if (window.navigator.userAgent.match(/Android/i)) {
    document.addEventListener('backbutton', (e) => {
        e.preventDefault();
    }, {
        passive: true
    });