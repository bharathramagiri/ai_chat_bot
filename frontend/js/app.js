lucide.createIcons();

// --- CUSTOM MARKDOWN RENDERER (Clean Copy Button & Image Fix) ---
const renderer = {
    code(code, lang) {
        // Handle differences in marked.js versions
        let text = typeof code === 'object' ? code.text : code;
        let language = typeof code === 'object' ? code.lang : lang;
        language = language || 'text';
        
        // Escape special characters so HTML inside code blocks doesn't break the page
        const escapedCode = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        return `
        <div class="relative group my-4 rounded-xl border border-white/10 bg-zinc-950 overflow-hidden shadow-lg">
            <div class="flex justify-between items-center px-4 py-2 bg-zinc-900/80 border-b border-white/5">
                <span class="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">${language}</span>
                <button onclick="copyCodeBlock(this)" class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors focus:outline-none">
                    <svg class="w-3.5 h-3.5 copy-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    <span class="copy-text font-medium">Copy</span>
                </button>
            </div>
            <div class="p-4 overflow-x-auto">
                <pre class="!m-0 !bg-transparent !p-0 border-0"><code class="language-${language} text-[13px] font-mono text-zinc-300 leading-relaxed">${escapedCode}</code></pre>
            </div>
        </div>`;
    },
    // This fixes the "broken image" icon by forcing the browser to wait gracefully
    image(href, title, text) {
        const url = typeof href === 'object' ? href.href : href;
        const alt = typeof href === 'object' ? href.text : text;
        return `<img src="${url}" alt="${alt}" class="max-w-full md:max-w-md rounded-xl shadow-2xl border border-white/10 my-4 object-cover" referrerpolicy="no-referrer">`;
    }
};
marked.use({ renderer });

// Global copy function triggered by the button
window.copyCodeBlock = function(button) {
    const container = button.closest('.group');
    const codeElement = container.querySelector('code');
    const textToCopy = codeElement.innerText || codeElement.textContent;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const span = button.querySelector('.copy-text');
        const icon = button.querySelector('.copy-icon');
        
        span.innerText = 'Copied!';
        button.classList.add('text-emerald-400');
        icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>'; 
        
        setTimeout(() => {
            span.innerText = 'Copy';
            button.classList.remove('text-emerald-400');
            icon.innerHTML = '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>';
        }, 2000);
    }).catch(() => showToast('Failed to copy code.'));
};
// -------------------------------------------------------------

let currentMode = 'chat';
let currentBase64Image = null;
let currentChatId = null;

let activeUser = JSON.parse(localStorage.getItem('pipai_active_user')) || null;
let chats = []; 

function getStorageKey() {
    return activeUser ? `pipai_chats_auth` : `pipai_chats_guest`;
}

function loadStorage() {
    chats = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    updateProfileUI();
    if (chats.length === 0) createNewChat();
    else loadChat(chats[0].id); 
    renderSidebar();
}

function saveChats() { 
    localStorage.setItem(getStorageKey(), JSON.stringify(chats)); 
    renderSidebar(); 
}

function updateProfileUI() {
    const nameEl = document.getElementById('userNameDisplay');
    const statusEl = document.getElementById('userStatusDisplay');
    const guestAvatar = document.getElementById('guestAvatar');
    const userAvatar = document.getElementById('userAvatar');

    if (activeUser) {
        nameEl.innerText = activeUser.name;
        statusEl.innerText = "Synced Workspace";
        statusEl.classList.replace('text-indigo-400', 'text-emerald-400');
        guestAvatar.classList.add('hidden');
        userAvatar.classList.remove('hidden');
        userAvatar.src = activeUser.avatar;
    } else {
        nameEl.innerText = "Guest User";
        statusEl.innerText = "Sign In to Sync";
        statusEl.classList.replace('text-emerald-400', 'text-indigo-400');
        guestAvatar.classList.remove('hidden');
        userAvatar.classList.add('hidden');
    }
}

function handleProfileClick() {
    if (activeUser) {
        document.getElementById('accountModalName').innerText = activeUser.name;
        document.getElementById('accountModalEmail').innerText = activeUser.email;
        document.getElementById('accountModalAvatar').src = activeUser.avatar;
        document.getElementById('accountModal').classList.remove('hidden');
        document.getElementById('accountModal').classList.add('flex');
    } else {
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('loginModal').classList.add('flex');
    }
}

function showRealisticGoogleLogin() {
    document.getElementById('loginStep1').classList.add('hidden');
    document.getElementById('loginStep2').classList.remove('hidden');
    setTimeout(() => { document.getElementById('googleNameInput').focus(); }, 100);
}

function finalizeLogin() {
    const name = document.getElementById('googleNameInput').value.trim();
    if (!name) return;
    
    const btn = document.querySelector('#loginStep2 button:last-child');
    btn.innerHTML = '<span class="animate-pulse">Connecting...</span>';
    btn.disabled = true;

    setTimeout(() => {
        const email = name.toLowerCase().replace(/\s+/g, '') + "@gmail.com";
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128&bold=true`;

        activeUser = { name, email, avatar: avatarUrl };
        localStorage.setItem('pipai_active_user', JSON.stringify(activeUser));
        
        showToast(`Welcome back, ${name}!`);
        closeLoginModal();
        
        btn.innerHTML = 'Next';
        btn.disabled = false;
        document.getElementById('googleNameInput').value = '';

        loadStorage(); 
    }, 800);
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('loginModal').classList.remove('flex');
}

function closeAccountModal() {
    document.getElementById('accountModal').classList.add('hidden');
    document.getElementById('accountModal').classList.remove('flex');
}

function logoutWorkspace() {
    activeUser = null;
    localStorage.removeItem('pipai_active_user');
    showToast("Signed out. Switched to Guest Workspace.");
    closeAccountModal();
    loadStorage(); 
}

document.getElementById('imageInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            currentBase64Image = evt.target.result;
            document.getElementById('imagePreviewImg').src = currentBase64Image;
            document.getElementById('imagePreviewContainer').classList.remove('hidden');
            
            const btn = document.getElementById('sendBtn');
            btn.disabled = false;
            btn.classList.add('bg-white', 'text-black');
            btn.classList.remove('bg-white/5', 'text-zinc-500');
        };
        reader.readAsDataURL(file);
    }
});

function clearImage() {
    currentBase64Image = null;
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    
    if (document.getElementById('userInput').value.trim() === '') {
        const btn = document.getElementById('sendBtn');
        btn.disabled = true;
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-white/5', 'text-zinc-500');
    }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = true; 
    
    recognition.onstart = function() {
        isRecording = true;
        const micIcon = document.getElementById('micIcon');
        micIcon.classList.remove('text-zinc-400');
        micIcon.classList.add('text-red-500', 'animate-pulse', 'drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]');
        document.getElementById('userInput').placeholder = "Listening... Speak now.";
    };
    
    recognition.onresult = function(event) {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        const input = document.getElementById('userInput');
        if (finalTranscript) {
            input.value += (input.value ? ' ' : '') + finalTranscript;
            autoGrow(input);
            input.dispatchEvent(new Event('input')); 
        }
    };
    
    recognition.onerror = function(event) {
        if (event.error === 'not-allowed') {
            showToast("Microphone access denied by browser.");
        } else {
            showToast("Microphone error. Please try again.");
        }
        resetMicUI();
    };
    
    recognition.onend = function() { resetMicUI(); };
}

function toggleVoiceRecording() {
    if (!SpeechRecognition) {
        showToast("Voice input is only supported in Chrome, Edge, or Safari.");
        return;
    }
    if (isRecording) {
        recognition.stop();
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                stream.getTracks().forEach(track => track.stop());
                recognition.start();
            })
            .catch(err => {
                showToast("Microphone access blocked. Please allow it in your browser settings.");
                resetMicUI();
            });
    }
}

function resetMicUI() {
    isRecording = false;
    const micIcon = document.getElementById('micIcon');
    if(micIcon) {
        micIcon.classList.remove('text-red-500', 'animate-pulse', 'drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]');
        micIcon.classList.add('text-zinc-400');
    }
    document.getElementById('userInput').placeholder = "Ask PipAI anything...";
}

function showToast(message) {
    const existing = document.getElementById('toastMsg');
    if(existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = 'toast-enter fixed bottom-36 left-1/2 glass-panel text-white px-5 py-3 rounded-full text-sm font-semibold shadow-2xl z-[100] flex items-center gap-2.5 border border-white/10';
    toast.innerHTML = `<i data-lucide="info" class="w-4 h-4 text-indigo-400"></i> ${message}`;
    document.body.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function togglePlusMenu(e) { if(e) e.stopPropagation(); document.getElementById('plusMenu').classList.toggle('hidden'); document.getElementById('plusMenu').classList.toggle('flex'); }
function closePlusMenu() { document.getElementById('plusMenu').classList.add('hidden'); document.getElementById('plusMenu').classList.remove('flex'); }
function openCanvas() { document.getElementById('canvasPanel').classList.add('open'); closePlusMenu(); }
function closeCanvas() { document.getElementById('canvasPanel').classList.remove('open'); }
function sendCanvasToChat() { document.getElementById('userInput').value = document.getElementById('canvasEditor').value; closeCanvas(); document.getElementById('userInput').dispatchEvent(new Event('input')); autoGrow(document.getElementById('userInput')); }
function openToolsModal() { document.getElementById('toolsModal').classList.remove('hidden'); closePlusMenu(); }
function closeToolsModal() { document.getElementById('toolsModal').classList.add('hidden'); }
function openClearModal() { document.getElementById('clearHistoryModal').classList.remove('hidden'); document.getElementById('clearHistoryModal').classList.add('flex'); }
function closeClearModal() { document.getElementById('clearHistoryModal').classList.add('hidden'); document.getElementById('clearHistoryModal').classList.remove('flex'); }

function confirmClearAll() {
    localStorage.removeItem(getStorageKey()); 
    chats = []; 
    createNewChat(); 
    closeClearModal();
    showToast('History wiped successfully.');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('plusMenu');
    if (!menu.contains(e.target) && !document.getElementById('plusBtn').contains(e.target)) closePlusMenu();
});

function setMode(mode) {
    currentMode = mode;
    const input = document.getElementById('userInput');
    document.getElementById('modeBadgeImage').classList.add('hidden');
    document.getElementById('modeBadgeVideo').classList.add('hidden');
    
    if (mode === 'image') {
        input.placeholder = "Describe the image you want to create...";
        document.getElementById('modeBadgeImage').classList.remove('hidden');
        document.getElementById('modeBadgeImage').classList.add('flex');
    } else if (mode === 'video') {
        input.placeholder = "What should the video be about?";
        document.getElementById('modeBadgeVideo').classList.remove('hidden');
        document.getElementById('modeBadgeVideo').classList.add('flex');
    } else {
        input.placeholder = "Ask PipAI anything...";
    }
    input.focus();
    closePlusMenu();
}

loadStorage(); 

function createNewChat() {
    currentChatId = 'chat_' + Date.now();
    chats.unshift({ id: currentChatId, title: 'New Chat', messages: [{ role: "system", content: "You are PipAI." }] });
    saveChats(); renderChatArea(); setMode('chat');
}

function loadChat(id) { currentChatId = id; renderChatArea(); renderSidebar(); setMode('chat'); }

function deleteSingleChat(id) {
    chats = chats.filter(c => c.id !== id);
    saveChats(); 
    if (currentChatId === id) {
        if (chats.length > 0) loadChat(chats[0].id);
        else createNewChat();
    } else { renderSidebar(); }
}

function renderSidebar() {
    const list = document.getElementById('chatHistoryList');
    list.innerHTML = '';
    chats.forEach(chat => {
        if (chat.messages.length === 1) return; 
        const isActive = chat.id === currentChatId;
        
        const div = document.createElement('div');
        div.className = `group flex items-center justify-between py-3 px-4 rounded-xl text-sm cursor-pointer transition-all ${isActive ? 'bg-white/10 text-white font-medium shadow-sm border border-white/5' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`;
        div.onclick = () => loadChat(chat.id);
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'truncate flex-1';
        titleSpan.innerText = chat.title;
        div.appendChild(titleSpan);

        const delBtn = document.createElement('button');
        delBtn.className = 'ml-2 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/20 rounded-md opacity-0 group-hover:opacity-100 transition-all';
        delBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteSingleChat(chat.id); };
        div.appendChild(delBtn);

        list.appendChild(div);
    });
    lucide.createIcons();
}

function renderChatArea() {
    const contentDiv = document.getElementById('chatContent');
    contentDiv.innerHTML = '';
    const currentChat = chats.find(c => c.id === currentChatId);
    
    if (currentChat.messages.length === 1) {
        const greeting = activeUser ? `Welcome back, ${activeUser.name.split(' ')[0]}!` : "How can I help you today?";
        contentDiv.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center space-y-4 pt-32">
            <div class="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.1)]">
                <i data-lucide="sparkles" class="w-8 h-8 text-indigo-400"></i>
            </div>
            <h1 class="text-3xl font-bold gradient-text">${greeting}</h1>
        </div>`;
        lucide.createIcons();
    } else {
        currentChat.messages.forEach(msg => {
            if (msg.role !== 'system') appendBubble(msg.role, msg.content, false, msg.image);
        });
    }
}

function appendBubble(role, content, animate = true, imageUrl = null) {
    const container = document.getElementById('chatContainer');
    const contentDiv = document.getElementById('chatContent');
    
    if(contentDiv.innerHTML.includes('How can I help') || contentDiv.innerHTML.includes('Welcome back')) contentDiv.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} ${animate ? 'message-enter' : ''}`;
    
    if (role === 'user') {
        const bubble = document.createElement('div');
        bubble.className = 'px-5 py-3.5 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white max-w-[80%] rounded-br-sm shadow-md font-medium text-[15px]';
        
        let innerHTML = '';
        if (imageUrl) {
            innerHTML += `<img src="${imageUrl}" class="max-w-xs rounded-xl mb-3 object-cover border border-white/20 shadow-lg">`;
        }
        if (content) {
            innerHTML += `<div>${content}</div>`;
        }
        bubble.innerHTML = innerHTML;
        wrapper.appendChild(bubble);
    } else {
        const aiWrapper = document.createElement('div');
        aiWrapper.className = 'flex gap-4 max-w-[90%] w-full';
        
        const avatar = document.createElement('div');
        avatar.className = 'w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 mt-1 shadow-inner';
        avatar.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4 text-indigo-400"></i>';
        
        const bubble = document.createElement('div');
        bubble.className = 'markdown-body pt-1 pb-4 flex-1';
        bubble.innerHTML = marked.parse(content);

        const images = bubble.querySelectorAll('img');
        images.forEach(img => { if(img.alt === 'Generated Image') { img.classList.add('max-w-md', 'rounded-xl', 'shadow-xl', 'border', 'border-white/10'); } });

        aiWrapper.appendChild(avatar);
        aiWrapper.appendChild(bubble);
        wrapper.appendChild(aiWrapper);
    }
    
    contentDiv.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
    return wrapper.querySelector('.markdown-body'); 
}

function autoGrow(element) {
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 200) + "px"; 
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!document.getElementById('sendBtn').disabled) {
            document.getElementById('chatForm').dispatchEvent(new Event('submit'));
        }
    }
}

document.getElementById('userInput').addEventListener('input', function() {
    const btn = document.getElementById('sendBtn');
    if(this.value.trim() !== '' || currentBase64Image !== null) {
        btn.classList.add('bg-white', 'text-black');
        btn.classList.remove('bg-white/5', 'text-zinc-500');
        btn.disabled = false;
    } else {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-white/5', 'text-zinc-500');
        btn.disabled = true;
    }
});

async function handleMessageSubmit(e) {
    e.preventDefault();
    let text = document.getElementById('userInput').value.trim();
    let imageToSend = currentBase64Image; 
    
    if (!text && !imageToSend) return; 

    const isImgRequest = (currentMode === 'image');
    if (currentMode === 'video') { text = "Act as a professional Video AI Prompt Engineer. Write a highly detailed, cinematic text-to-video prompt for: " + text; }

    const currentChat = chats.find(c => c.id === currentChatId);
    if (currentChat.messages.length === 1) { currentChat.title = text ? text.substring(0, 25) : 'Image Upload'; }

    document.getElementById('userInput').value = '';
    document.getElementById('userInput').style.height = "auto";
    document.getElementById('userInput').dispatchEvent(new Event('input'));
    clearImage(); 

    let displayUserText = text;
    if(currentMode === 'image') displayUserText = `🎨 Create Image: ${text}`;
    if(currentMode === 'video') displayUserText = `🎬 Create Video Prompt: ${text.replace('Act as a professional Video AI Prompt Engineer. Write a highly detailed, cinematic text-to-video prompt for: ', '')}`;
    
    appendBubble('user', displayUserText, true, imageToSend);
    currentChat.messages.push({ role: 'user', content: text, image: imageToSend });
    saveChats(); 
    
    setMode('chat'); 
    const aiContentBox = appendBubble('assistant', '<span class="animate-pulse text-zinc-500 font-medium tracking-wide">Thinking...</span>');

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: currentChat.messages, is_image_request: isImgRequest })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let rawText = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            rawText += decoder.decode(value);
            aiContentBox.innerHTML = marked.parse(rawText);
            document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
        }
        currentChat.messages.push({ role: 'assistant', content: rawText });
        saveChats();
    } catch (error) {
        aiContentBox.innerHTML = "<span class='text-red-400 font-semibold'>Network Error. Please verify backend connection.</span>";
    }
}