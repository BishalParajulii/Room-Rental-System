let currentUser = null;
let token = localStorage.getItem('chat_token');
let activeUserId = null;
let chatSocket = null;
let renderedMessageIds = new Set();

if (token) {
    showChat();
}

async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    try {
        const response = await fetch('/api/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        const data = await response.json();

        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('chat_token', token);
            localStorage.setItem('chat_user', JSON.stringify(currentUser));
            showChat();
        } else {
            let msg = "Invalid credentials";
            if (data.non_field_errors) msg = data.non_field_errors[0];
            else if (data.detail) msg = data.detail;
            else if (typeof data === 'object') msg = Object.values(data)[0];
            errorEl.textContent = msg;
        }
    } catch (err) {
        errorEl.textContent = "Server error";
    }
}

function logout() {
    if (chatSocket) chatSocket.close();
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    location.reload();
}

function connectChatSocket() {
    if (!token || (chatSocket && chatSocket.readyState <= WebSocket.OPEN)) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    chatSocket = new WebSocket(`${protocol}://${window.location.host}/ws/chat/?token=${encodeURIComponent(token)}`);

    chatSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'chat.message') {
            handleIncomingMessage(data.message);
        }
    };

    chatSocket.onclose = () => {
        setTimeout(connectChatSocket, 2000);
    };

    chatSocket.onerror = (error) => {
        console.error("Chat socket error:", error);
    };
}

function showChat() {
    const loginScreen = document.getElementById('login-screen');
    const chatLayout = document.getElementById('chat-layout');
    const userDisplay = document.getElementById('current-user-display');

    if (loginScreen) loginScreen.style.display = 'none';
    if (chatLayout) chatLayout.style.display = 'grid';
    
    currentUser = JSON.parse(localStorage.getItem('chat_user'));
    if (userDisplay && currentUser) {
        userDisplay.textContent = currentUser.username;
    }
    
    connectChatSocket();
    loadConversations();
}

async function loadConversations() {
    if (!token) return;

    try {
        const res = await fetch('/api/chat/conversations/', {
            headers: { 'Authorization': `Token ${token}` }
        });
        const users = await res.json();
        const listEl = document.getElementById('conv-list');
        
        if (!listEl) return;

        // If empty, maybe show 'No chats yet'
        if (users.length === 0) {
            listEl.innerHTML = '<p style="padding: 1rem; text-align: center; color: gray;">No active chats</p>';
            return;
        }

        listEl.innerHTML = users.map(user => `
            <div class="conv-item ${activeUserId === user.id ? 'active' : ''}" onclick="selectUser(${user.id}, '${user.username}')">
                <div class="avatar">${user.username[0].toUpperCase()}</div>
                <div class="conv-info">
                    <h4>${user.username}</h4>
                    <p>${user.role}</p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Failed to load conversations:", err);
    }
}

function selectUser(id, name) {
    activeUserId = id;
    renderedMessageIds = new Set();
    const nameEl = document.getElementById('active-user-name');
    const avatarEl = document.getElementById('active-avatar');
    const statusEl = document.getElementById('active-user-status');

    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
    if (statusEl) statusEl.textContent = 'Online';
    
    // Update active state in sidebar
    const items = document.querySelectorAll('.conv-item');
    items.forEach(item => item.classList.remove('active'));
    
    loadHistory();
}

async function loadHistory() {
    if (!activeUserId || !token) return;

    try {
        const res = await fetch(`/api/chat/history/${activeUserId}/`, {
            headers: { 'Authorization': `Token ${token}` }
        });
        const messages = await res.json();
        const box = document.getElementById('messages-box');

        if (!box) return;

        if (messages.length === 0) {
            box.innerHTML = '<div class="empty-state"><p>No messages with this user yet.</p></div>';
            return;
        }

        const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 100;
        renderedMessageIds = new Set(messages.map(msg => msg.id));

        box.innerHTML = messages.map(msg => `
            <div class="message ${msg.sender === currentUser.id ? 'sent' : 'received'}">
                ${msg.content}
                <span class="time">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `).join('');

        if (atBottom) {
            box.scrollTop = box.scrollHeight;
        }
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}

function handleIncomingMessage(message) {
    if (!currentUser) return;

    const senderId = Number(message.sender);
    const receiverId = Number(message.receiver);
    const currentUserId = Number(currentUser.id);
    const openChatId = Number(activeUserId);
    const belongsToActiveChat = openChatId && (
        (senderId === currentUserId && receiverId === openChatId) ||
        (senderId === openChatId && receiverId === currentUserId)
    );

    loadConversations();

    if (!belongsToActiveChat || renderedMessageIds.has(message.id)) return;

    const box = document.getElementById('messages-box');
    if (!box) return;

    const emptyState = box.querySelector('.empty-state');
    if (emptyState) box.innerHTML = '';

    const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 100;
    renderedMessageIds.add(message.id);

    box.insertAdjacentHTML('beforeend', `
        <div class="message ${senderId === currentUserId ? 'sent' : 'received'}">
            ${message.content}
            <span class="time">${new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
    `);

    if (atBottom || senderId === currentUserId) {
        box.scrollTop = box.scrollHeight;
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content || !activeUserId || !token) return;

    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            type: 'chat.message',
            receiver: activeUserId,
            content: content
        }));
        input.value = '';
        return;
    }

    try {
        const res = await fetch('/api/chat/send/', {
            method: 'POST',
            headers: { 
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ receiver: activeUserId, content: content })
        });

        if (res.ok) {
            input.value = '';
        }
    } catch (err) {
        console.error("Failed to send message:", err);
    }
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}
