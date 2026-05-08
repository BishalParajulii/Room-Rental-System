/**
 * Room Rental Professional Dashboard JS
 */

const app = {
    token: localStorage.getItem('chat_token'),
    user: JSON.parse(localStorage.getItem('chat_user')),
    activeView: 'overview',
    activeChatUser: null,
    pollInterval: null,
    searchTerm: '',
    locationFilter: '',

    init() {
        this.bindEvents();
        this.checkAuth();
        this.initTheme();
    },

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Modals
        const addRoomBtn = document.getElementById('add-room-trigger');
        if (addRoomBtn) addRoomBtn.addEventListener('click', () => this.toggleModal('add-room-modal', true));
        
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.closest('.modal').id;
                this.toggleModal(modalId, false);
            });
        });

        // Forms
        const addRoomForm = document.getElementById('add-room-form');
        if (addRoomForm) addRoomForm.addEventListener('submit', (e) => this.handleAddRoom(e));
        
        // Search & Filters
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                if (this.activeView === 'rooms') this.loadRooms();
            });
        }

        const locFilter = document.getElementById('location-filter');
        if (locFilter) {
            locFilter.addEventListener('change', (e) => {
                this.locationFilter = e.target.value;
                this.loadRooms();
            });
        }

        // Chat
        const chatSearch = document.getElementById('chat-search-input');
        if (chatSearch) chatSearch.addEventListener('input', () => this.loadConversations());

        document.getElementById('send-msg-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    },

    initTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.className = `${theme}-mode`;
        const icon = document.querySelector('#theme-toggle i');
        if (theme === 'dark') icon.className = 'fas fa-sun';
    },

    toggleTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        const newTheme = isDark ? 'light' : 'dark';
        document.body.className = `${newTheme}-mode`;
        localStorage.setItem('theme', newTheme);
        document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    },

    checkAuth() {
        if (!this.token) {
            window.location.href = '/login/';
        } else {
            this.updateUserUI();
            this.loadViewData('overview');
        }
    },

    updateUserUI() {
        if (!this.user) return;
        document.getElementById('sidebar-username').textContent = this.user.username;
        document.getElementById('sidebar-role').textContent = this.user.role.charAt(0).toUpperCase() + this.user.role.slice(1);
        document.getElementById('sidebar-avatar').textContent = this.user.username[0].toUpperCase();
        document.getElementById('welcome-name').textContent = this.user.username;

        // Show "Add Room" only for landlords
        const addRoomBtn = document.getElementById('add-room-trigger');
        if (this.user.role === 'landlord' || this.user.role === 'admin') {
            addRoomBtn.style.display = 'flex';
        }
    },

    logout() {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
        window.location.reload();
    },

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (show) modal.classList.add('active');
        else modal.classList.remove('active');
    },

    switchView(viewId) {
        this.activeView = viewId;
        
        // Update Nav UI
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-view') === viewId);
        });

        // Update View UI
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewId}`);
        });

        this.loadViewData(viewId);
    },

    loadViewData(viewId) {
        switch(viewId) {
            case 'overview': this.loadOverview(); break;
            case 'rooms': this.loadRooms(); break;
            case 'bookings': this.loadBookings(); break;
            case 'chat': this.loadConversations(); break;
        }
    },

    async loadOverview() {
        // Fetch stats (mocked for now or fetched from actual endpoints)
        try {
            const [roomsRes, bookingsRes] = await Promise.all([
                fetch('/api/rooms/', { headers: { 'Authorization': `Token ${this.token}` }}),
                fetch('/api/bookings/', { headers: { 'Authorization': `Token ${this.token}` }})
            ]);
            
            const rooms = await roomsRes.json();
            const bookings = await bookingsRes.json();
            
            const stats = document.querySelectorAll('.stat-info h3');
            stats[0].textContent = rooms.length;
            stats[1].textContent = bookings.length;
            // Total earnings logic would go here if available
        } catch (err) {
            console.error("Failed to load overview data", err);
        }
    },

    async loadRooms() {
        const grid = document.getElementById('rooms-grid');
        grid.innerHTML = '<div class="loader">Loading rooms...</div>';

        try {
            const res = await fetch('/api/rooms/', {
                headers: { 'Authorization': `Token ${this.token}` }
            });
            let rooms = await res.json();
            
            // Populate location filter if not done
            this.updateLocationFilter(rooms);

            // Apply Filters
            if (this.locationFilter) {
                rooms = rooms.filter(r => r.city === this.locationFilter || r.state === this.locationFilter);
            }
            if (this.searchTerm) {
                rooms = rooms.filter(r => 
                    r.description.toLowerCase().includes(this.searchTerm) || 
                    r.location.toLowerCase().includes(this.searchTerm) ||
                    r.city.toLowerCase().includes(this.searchTerm) ||
                    r.state.toLowerCase().includes(this.searchTerm)
                );
            }

            if (rooms.length === 0) {
                grid.innerHTML = '<p class="empty-msg">No rooms matching your search.</p>';
                return;
            }

            grid.innerHTML = rooms.map(room => `
                <div class="room-card">
                    <div class="room-img">
                        ${room.image ? `<img src="${room.image}" alt="Room" style="width: 100%; height: 100%; object-fit: cover;">` : '<i class="fas fa-image"></i>'}
                    </div>
                    <div class="room-content">
                        <div class="room-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${room.city}, ${room.state}</span>
                            <span class="status-tag ${room.availability_status}">${room.availability_status}</span>
                        </div>
                        <h3>${room.description.substring(0, 50)}...</h3>
                        <p class="room-price">Rs. ${room.price}</p>
                        <div style="display: flex; gap: 0.5rem;">
                            ${room.availability_status === 'open' ? `<button class="primary-btn" style="flex: 1;" onclick="app.createBooking(${room.id})">Book Now</button>` : `<button class="primary-btn" style="flex: 1; opacity: 0.6; cursor: not-allowed;" disabled>Booked</button>`}
                            <button class="icon-btn" title="Message Landlord" onclick="app.startChat(${room.landlord.id}, '${room.landlord.username}')">
                                <i class="fas fa-comment"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            grid.innerHTML = '<p class="error-msg">Failed to load rooms.</p>';
        }
    },

    updateLocationFilter(rooms) {
        const select = document.getElementById('location-filter');
        if (!select || select.options.length > 1) return; // Already populated

        const cities = [...new Set(rooms.map(r => r.city))];
        cities.forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            select.appendChild(opt);
        });
    },

    async handleAddRoom(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('description', document.getElementById('room-desc').value);
        formData.append('price', document.getElementById('room-price').value);
        formData.append('location', document.getElementById('room-location').value);
        formData.append('city', document.getElementById('room-city').value);
        formData.append('state', document.getElementById('room-state').value);
        
        const imageFile = document.getElementById('room-image').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const res = await fetch('/api/rooms/create/', {
                method: 'POST',
                headers: { 
                    'Authorization': `Token ${this.token}`
                    // Note: Browser sets Content-Type automatically for FormData
                },
                body: formData
            });

            if (res.ok) {
                this.toggleModal('add-room-modal', false);
                this.switchView('rooms');
            } else {
                alert("Failed to create room. Please check your inputs.");
            }
        } catch (err) {
            console.error("Error adding room", err);
        }
    },

    async loadBookings() {
        const tbody = document.getElementById('bookings-table-body');
        tbody.innerHTML = '<tr><td colspan="6">Loading bookings...</td></tr>';

        try {
            const res = await fetch('/api/bookings/', {
                headers: { 'Authorization': `Token ${this.token}` }
            });
            const bookings = await res.json();

            if (bookings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No bookings found.</td></tr>';
                return;
            }

            tbody.innerHTML = bookings.map(b => {
                const statusIcon = b.status === 'confirmed' ? 'fa-check-circle' : (b.status === 'pending' ? 'fa-clock' : 'fa-times-circle');
                const paymentIcon = b.payment_status === 'paid' ? 'fa-check' : 'fa-wallet';
                
                return `
                    <tr>
                        <td>
                            <div style="font-weight: 600; color: var(--primary);">#${b.booking_reference}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(b.created_at).toLocaleDateString()}</div>
                        </td>
                        <td>
                            <div style="font-weight: 500;">Room #${b.room.id}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${b.room.city}</div>
                        </td>
                        <td>
                            <div style="font-weight: 500;">${new Date(b.check_in).toLocaleDateString()}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Check-in Date</div>
                        </td>
                        <td><span class="status-tag ${b.status}"><i class="fas ${statusIcon}"></i> ${b.status}</span></td>
                        <td><span class="status-tag ${b.payment_status}"><i class="fas ${paymentIcon}"></i> ${b.payment_status}</span></td>
                        <td>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="icon-btn" title="View Details" onclick="app.viewBooking(${b.id})">
                                    <i class="fas fa-expand-alt"></i>
                                </button>
                                ${(this.user.role === 'landlord' || this.user.role === 'admin') && b.status === 'pending' ? `
                                    <button class="icon-btn success" title="Accept Booking" onclick="app.updateBookingStatus(${b.id}, 'confirmed')">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button class="icon-btn danger" title="Reject Booking" onclick="app.updateBookingStatus(${b.id}, 'cancelled')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                ` : ''}
                                ${this.user.role === 'tenant' && b.status === 'pending' ? `
                                    <button class="icon-btn danger" title="Cancel Request" onclick="app.updateBookingStatus(${b.id}, 'cancelled')">
                                        <i class="fas fa-ban"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="error-msg">Failed to load bookings.</td></tr>';
        }
    },

    async createBooking(roomId) {
        if (!confirm("Are you sure you want to book this room?")) return;
        
        try {
            const res = await fetch('/api/bookings/create/', {
                method: 'POST',
                headers: { 
                    'Authorization': `Token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room: roomId,
                    check_in: new Date().toISOString().split('T')[0],
                    status: 'pending'
                })
            });

            if (res.ok) {
                alert("Booking request sent successfully!");
                this.switchView('bookings');
            } else {
                alert("Booking failed. You might already have a pending request.");
            }
        } catch (err) {
            console.error("Error creating booking", err);
        }
    },

    async updateBookingStatus(bookingId, newStatus) {
        if (!confirm(`Are you sure you want to ${newStatus === 'confirmed' ? 'accept' : (newStatus === 'cancelled' ? 'cancel/reject' : 'update')} this booking?`)) return;
        
        try {
            const res = await fetch(`/api/bookings/${bookingId}/update/`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                this.loadBookings();
            } else {
                alert("Failed to update booking status.");
            }
        } catch (err) {
            console.error("Error updating booking", err);
        }
    },

    async viewBooking(id) {
        try {
            const res = await fetch(`/api/bookings/${id}/`, {
                headers: { 'Authorization': `Token ${this.token}` }
            });
            const b = await res.json();
            
            const content = document.getElementById('booking-details-content');
            const footer = document.getElementById('booking-modal-footer');
            
            content.innerHTML = `
                <div class="booking-details-grid">
                    <div class="detail-item">
                        <label>Booking Reference</label>
                        <p>#${b.booking_reference}</p>
                    </div>
                    <div class="detail-item">
                        <label>Current Status</label>
                        <p><span class="status-tag ${b.status}">${b.status}</span></p>
                    </div>
                    <div class="detail-item">
                        <label>Check-in Date</label>
                        <p>${new Date(b.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div class="detail-item">
                        <label>Payment Status</label>
                        <p><span class="status-tag ${b.payment_status}">${b.payment_status}</span></p>
                    </div>
                    <div class="detail-item">
                        <label>Room Details</label>
                        <p>${b.room.description}</p>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${b.room.location}, ${b.room.city}</span>
                    </div>
                    <div class="detail-item">
                        <label>${this.user.role === 'landlord' ? 'Tenant' : 'Landlord'} Information</label>
                        <p>${b.tenant.username}</p>
                        <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-phone-alt"></i> ${b.tenant.contact_number || 'No contact provided'}</span>
                    </div>
                    <div class="detail-item full-width" style="background: var(--bg-main); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
                        <label>Special Requests</label>
                        <p style="font-style: ${b.special_requests ? 'normal' : 'italic'}; color: ${b.special_requests ? 'inherit' : 'var(--text-muted)'};">
                            ${b.special_requests || 'No special requests submitted.'}
                        </p>
                    </div>
                </div>
            `;
            
            footer.innerHTML = '';
            if (b.status === 'pending') {
                if (this.user.role === 'landlord' || this.user.role === 'admin') {
                    footer.innerHTML = `
                        <button class="primary-btn success" onclick="app.updateBookingStatus(${b.id}, 'confirmed'); app.toggleModal('booking-details-modal', false)">Confirm Booking</button>
                        <button class="primary-btn danger" onclick="app.updateBookingStatus(${b.id}, 'cancelled'); app.toggleModal('booking-details-modal', false)">Reject Booking</button>
                    `;
                } else if (this.user.role === 'tenant') {
                    footer.innerHTML = `
                        <button class="primary-btn danger" onclick="app.updateBookingStatus(${b.id}, 'cancelled'); app.toggleModal('booking-details-modal', false)">Cancel Booking</button>
                    `;
                }
            }
            
            this.toggleModal('booking-details-modal', true);
        } catch (err) {
            console.error("Error loading booking details", err);
        }
    },

    // Chat Logic
    async loadConversations() {
        const listEl = document.getElementById('conv-list');
        const searchInput = document.getElementById('chat-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        try {
            const res = await fetch('/api/chat/conversations/', {
                headers: { 'Authorization': `Token ${this.token}` }
            });
            let users = await res.json();
            
            if (searchTerm) {
                users = users.filter(u => u.username.toLowerCase().includes(searchTerm));
            }

            if (users.length === 0) {
                listEl.innerHTML = `<div class="chat-empty" style="padding: 2rem;">
                    <p>${searchTerm ? 'No matches found' : 'No active chats'}</p>
                </div>`;
                return;
            }

            listEl.innerHTML = users.map(user => `
                <div class="conv-item ${this.activeChatUser === user.id ? 'active' : ''}" onclick="app.selectChatUser(${user.id}, '${user.username}')">
                    <div class="avatar">${user.username[0].toUpperCase()}</div>
                    <div class="conv-info">
                        <h4>${user.username}</h4>
                        <p>${user.role}</p>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error("Chat error", err);
        }
    },

    startChat(userId, username) {
        this.switchView('chat');
        this.selectChatUser(userId, username);
    },

    selectChatUser(id, name) {
        console.log("Opening chat with:", name, "ID:", id);
        this.activeChatUser = id;
        this.lastMessageCount = 0;
        
        const nameEl = document.getElementById('active-user-name');
        const avatarEl = document.getElementById('active-avatar');
        const input = document.getElementById('message-input');

        if (nameEl) nameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
        
        if (input) {
            input.value = '';
            input.placeholder = `Message ${name}...`;
            input.focus();
        }
        
        this.loadHistory(true);
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => this.loadHistory(false), 3000);
        
        this.loadConversations();
    },

    async loadHistory(forceScroll = false) {
        if (!this.activeChatUser || this.activeView !== 'chat') return;

        try {
            const res = await fetch(`/api/chat/history/${this.activeChatUser}/`, {
                headers: { 'Authorization': `Token ${this.token}` }
            });
            const messages = await res.json();
            const box = document.getElementById('messages-box');

            if (!box) return;

            // Only re-render if message count changed to prevent jitter
            if (messages.length === this.lastMessageCount && !forceScroll) return;
            this.lastMessageCount = messages.length;

            if (messages.length === 0) {
                box.innerHTML = '<div class="chat-empty"><p>No messages yet.</p></div>';
                return;
            }

            const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 150;
            const currentUserId = this.user ? Number(this.user.id) : 0;
            
            let html = '';
            let lastDate = null;

            messages.forEach(msg => {
                const msgDate = new Date(msg.created_at).toLocaleDateString();
                if (msgDate !== lastDate) {
                    const displayDate = msgDate === new Date().toLocaleDateString() ? 'Today' : msgDate;
                    html += `<div class="date-divider"><span>${displayDate}</span></div>`;
                    lastDate = msgDate;
                }

                html += `
                    <div class="message ${Number(msg.sender) === currentUserId ? 'sent' : 'received'}">
                        <div class="msg-content">${msg.content}</div>
                        <span class="time">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                `;
            });

            box.innerHTML = html;

            if (forceScroll || atBottom) {
                box.scrollTop = box.scrollHeight;
            }
        } catch (err) {
            console.error("History error", err);
        }
    },

    async sendMessage() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        
        if (!this.activeChatUser) {
            alert("Please select a user from the sidebar to start chatting.");
            return;
        }
        if (!content) return;

        // Optimistic UI could go here, but let's keep it simple for now
        try {
            const res = await fetch('/api/chat/send/', {
                method: 'POST',
                headers: { 
                    'Authorization': `Token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ receiver: this.activeChatUser, content: content })
            });

            if (res.ok) {
                input.value = '';
                this.loadHistory(true);
            }
        } catch (err) {
            console.error("Send error", err);
        }
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => app.init());
