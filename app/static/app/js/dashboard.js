/**
 * Room Rental Professional Dashboard JS
 */

const app = {
    token: localStorage.getItem('chat_token'),
    user: null,
    activeView: 'overview',
    activeChatUser: null,
    chatSocket: null,
    renderedMessageIds: new Set(),
    searchTerm: '',
    locationFilter: '',
    roomCache: [],
    publicViews: ['overview', 'rooms'],
    provinces: [
        'Koshi Province',
        'Madhesh Province',
        'Bagmati Province',
        'Gandaki Province',
        'Lumbini Province',
        'Karnali Province',
        'Sudurpashchim Province'
    ],
    districtsByProvince: {
        'Koshi Province': [
            'Bhojpur', 'Dhankuta', 'Ilam', 'Jhapa', 'Khotang', 'Morang', 'Okhaldhunga',
            'Panchthar', 'Sankhuwasabha', 'Solukhumbu', 'Sunsari', 'Taplejung', 'Terhathum', 'Udayapur'
        ],
        'Madhesh Province': [
            'Bara', 'Dhanusha', 'Mahottari', 'Parsa', 'Rautahat', 'Saptari', 'Sarlahi', 'Siraha'
        ],
        'Bagmati Province': [
            'Bhaktapur', 'Chitwan', 'Dhading', 'Dolakha', 'Kathmandu', 'Kavrepalanchok',
            'Lalitpur', 'Makwanpur', 'Nuwakot', 'Ramechhap', 'Rasuwa', 'Sindhuli', 'Sindhupalchok'
        ],
        'Gandaki Province': [
            'Baglung', 'Gorkha', 'Kaski', 'Lamjung', 'Manang', 'Mustang',
            'Myagdi', 'Nawalpur', 'Parbat', 'Syangja', 'Tanahun'
        ],
        'Lumbini Province': [
            'Arghakhanchi', 'Banke', 'Bardiya', 'Dang', 'Gulmi', 'Kapilvastu',
            'Parasi', 'Palpa', 'Pyuthan', 'Rolpa', 'Rukum East', 'Rupandehi'
        ],
        'Karnali Province': [
            'Dailekh', 'Dolpa', 'Humla', 'Jajarkot', 'Jumla', 'Kalikot',
            'Mugu', 'Rukum West', 'Salyan', 'Surkhet'
        ],
        'Sudurpashchim Province': [
            'Achham', 'Baitadi', 'Bajhang', 'Bajura', 'Dadeldhura', 'Darchula',
            'Doti', 'Kailali', 'Kanchanpur'
        ]
    },

    init() {
        this.user = this.readSavedUser();
        this.initLocationFields();
        this.bindEvents();
        this.checkAuth();
        this.initTheme();
    },

    initLocationFields() {
        const provinceSelect = document.getElementById('room-state');
        if (provinceSelect && provinceSelect.options.length <= 1) {
            this.provinces.forEach(province => {
                const opt = document.createElement('option');
                opt.value = province;
                opt.textContent = province;
                provinceSelect.appendChild(opt);
            });
        }

        const districtList = document.getElementById('district-options');
        if (districtList && !districtList.children.length) {
            this.getAllDistricts().forEach(district => {
                const opt = document.createElement('option');
                opt.value = district;
                districtList.appendChild(opt);
            });
            this.provinces.forEach(province => {
                const opt = document.createElement('option');
                opt.value = province;
                districtList.appendChild(opt);
            });
        }
    },

    getAllDistricts() {
        return Object.values(this.districtsByProvince).flat();
    },

    provinceForDistrict(district) {
        const normalized = String(district || '').toLowerCase();
        return Object.entries(this.districtsByProvince).find(([, districts]) => (
            districts.some(item => item.toLowerCase() === normalized)
        ))?.[0] || '';
    },

    readSavedUser() {
        try {
            return JSON.parse(localStorage.getItem('chat_user'));
        } catch (err) {
            localStorage.removeItem('chat_user');
            return null;
        }
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

        const bookingForm = document.getElementById('booking-form');
        if (bookingForm) bookingForm.addEventListener('submit', (e) => this.handleCreateBooking(e));
        
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

        const cityInput = document.getElementById('room-city');
        if (cityInput) {
            cityInput.addEventListener('change', () => {
                const province = this.provinceForDistrict(cityInput.value);
                const provinceSelect = document.getElementById('room-state');
                if (province && provinceSelect) provinceSelect.value = province;
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

    escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    },

    formatMoney(value) {
        return `Rs. ${Number(value || 0).toLocaleString('en-NP')}`;
    },

    getApiError(data, fallback = 'Something went wrong. Please try again.') {
        if (!data) return fallback;
        if (typeof data === 'string') return data;
        if (Array.isArray(data)) return data.join(' ');
        if (data.detail) return data.detail;
        if (data.non_field_errors) return data.non_field_errors.join(' ');
        const firstKey = Object.keys(data)[0];
        const firstValue = firstKey ? data[firstKey] : null;
        if (Array.isArray(firstValue)) return `${firstKey}: ${firstValue.join(' ')}`;
        if (firstValue) return `${firstKey}: ${firstValue}`;
        return fallback;
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4200);
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

    async checkAuth() {
        if (!this.token) {
            this.setGuestUI();
            this.switchView('rooms');
            return;
        }

        try {
            const res = await fetch('/api/me/', {
                headers: { 'Authorization': `Token ${this.token}` }
            });
            if (!res.ok) throw new Error('Invalid saved session');
            this.user = await res.json();
            localStorage.setItem('chat_user', JSON.stringify(this.user));
            this.updateUserUI();
            this.connectChatSocket();
            this.loadViewData('overview');
        } catch (err) {
            this.clearSavedSession();
            this.setGuestUI();
            this.switchView('rooms');
            this.showToast('Your previous session is no longer valid. Please sign in again when you want to book.', 'error');
        }
    },

    clearSavedSession() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
    },

    isAuthenticated() {
        return Boolean(this.token && this.user);
    },

    requireAuth(message = 'Please sign in to continue.') {
        if (this.isAuthenticated()) return true;
        this.showToast(message, 'error');
        setTimeout(() => this.goToLogin(), 700);
        return false;
    },

    goToLogin() {
        window.location.href = '/login/';
    },

    handleAuthAction() {
        if (this.isAuthenticated()) this.logout();
        else this.goToLogin();
    },

    setGuestUI() {
        document.getElementById('sidebar-username').textContent = 'Guest';
        document.getElementById('sidebar-role').textContent = 'Browsing rooms';
        document.getElementById('sidebar-avatar').textContent = 'G';
        const loginBtn = document.getElementById('login-trigger');
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        const addRoomBtn = document.getElementById('add-room-trigger');
        if (addRoomBtn) addRoomBtn.style.display = 'none';
        const authBtn = document.getElementById('auth-action-btn');
        if (authBtn) {
            authBtn.title = 'Sign in';
            authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        }
        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.getAttribute('data-view');
            item.style.display = this.publicViews.includes(view) ? '' : 'none';
        });
    },

    updateUserUI() {
        if (!this.user) return;
        document.getElementById('sidebar-username').textContent = this.user.username;
        document.getElementById('sidebar-role').textContent = this.user.role.charAt(0).toUpperCase() + this.user.role.slice(1);
        document.getElementById('sidebar-avatar').textContent = this.user.username[0].toUpperCase();
        const welcomeCopy = document.getElementById('welcome-copy');
        if (welcomeCopy) welcomeCopy.textContent = `Welcome back, ${this.user.username}. Search rooms, manage bookings, and message safely from one place.`;
        const loginBtn = document.getElementById('login-trigger');
        if (loginBtn) loginBtn.style.display = 'none';
        const authBtn = document.getElementById('auth-action-btn');
        if (authBtn) {
            authBtn.title = 'Logout';
            authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        }
        document.querySelectorAll('.nav-item').forEach(item => {
            item.style.display = '';
        });

        // Show "Add Room" only for landlords
        const addRoomBtn = document.getElementById('add-room-trigger');
        if (this.user.role === 'landlord' || this.user.role === 'admin') {
            addRoomBtn.style.display = 'flex';
        }
    },

    logout() {
        if (this.chatSocket) this.chatSocket.close();
        this.clearSavedSession();
        this.setGuestUI();
        this.switchView('rooms');
    },

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.toggle('active', show);
    },

    switchView(viewId) {
        if (!this.publicViews.includes(viewId) && !this.requireAuth('Please sign in to use this section.')) return;
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
        try {
            const roomsRes = await fetch('/api/rooms/open/');
            const rooms = await roomsRes.json();
            const bookings = this.isAuthenticated()
                ? await fetch('/api/bookings/', { headers: { 'Authorization': `Token ${this.token}` }}).then(res => res.ok ? res.json() : [])
                : [];
            
            const stats = document.querySelectorAll('.stat-info h3');
            stats[0].textContent = rooms.length;
            stats[1].textContent = bookings.length;
            const confirmed = bookings.filter(b => b.status === 'confirmed');
            const total = confirmed.reduce((sum, b) => sum + Number(b.room?.price || 0), 0);
            stats[2].textContent = this.formatMoney(total);

            const activityList = document.getElementById('activity-list');
            if (activityList) {
                activityList.innerHTML = bookings.slice(0, 5).map(b => `
                    <div class="activity-item">
                        <div>
                            <strong>#${this.escapeHTML(b.booking_reference)}</strong>
                            <span>${this.escapeHTML(b.room?.city || 'Room')}</span>
                        </div>
                        <span class="status-tag ${this.escapeHTML(b.status)}">${this.escapeHTML(b.status)}</span>
                    </div>
                `).join('') || '<p class="empty-msg">Sign in to see booking activity here.</p>';
            }
        } catch (err) {
            console.error("Failed to load overview data", err);
            this.showToast('Could not load overview data.', 'error');
        }
    },

    async loadRooms() {
        const grid = document.getElementById('rooms-grid');
        grid.innerHTML = '<div class="loader">Loading rooms...</div>';

        try {
            const headers = this.token ? { 'Authorization': `Token ${this.token}` } : {};
            const res = await fetch('/api/rooms/open/', { headers });
            if (!res.ok) throw new Error('Room request failed');
            let rooms = await res.json();
            this.roomCache = rooms;
            this.updateAvailableLocationFilter(rooms);

            // Apply Filters
            if (this.locationFilter) {
                rooms = rooms.filter(r => {
                    return r.city === this.locationFilter || r.state === this.locationFilter;
                });
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
                        ${room.image ? `<img src="${this.escapeHTML(room.image)}" alt="Room">` : '<i class="fas fa-image"></i>'}
                    </div>
                    <div class="room-content">
                        <div class="room-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${this.escapeHTML(room.city)}, ${this.escapeHTML(room.state)}</span>
                            <span class="status-tag ${this.escapeHTML(room.availability_status)}">${this.escapeHTML(room.availability_status)}</span>
                        </div>
                        <h3>${this.escapeHTML(room.description.length > 80 ? `${room.description.substring(0, 80)}...` : room.description)}</h3>
                        <p class="room-address">${this.escapeHTML(room.location)}</p>
                        <p class="room-price">${this.formatMoney(room.price)}</p>
                        <div class="room-actions">
                            ${room.availability_status === 'open' ? `<button class="primary-btn" onclick="app.createBooking(${room.id})">${this.isAuthenticated() ? 'Book Now' : 'Sign in to book'}</button>` : `<button class="primary-btn muted" disabled>Unavailable</button>`}
                            ${this.user && Number(this.user.id) === Number(room.landlord.id) ? '' : `<button class="icon-btn" title="Message Landlord" onclick="app.startChat(${room.landlord.id}, '${this.escapeHTML(room.landlord.username)}')">
                                <i class="fas fa-comment"></i>
                            </button>`}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            grid.innerHTML = '<p class="error-msg">Failed to load rooms.</p>';
            this.showToast('Rooms could not be loaded.', 'error');
        }
    },

    updateAvailableLocationFilter(rooms) {
        const select = document.getElementById('location-filter');
        if (!select) return;

        const currentValue = select.value;
        const locations = [...new Set(
            rooms.flatMap(room => [room.city, room.state]).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        select.innerHTML = '<option value="">All available locations</option>';
        locations.forEach(location => {
            const opt = document.createElement('option');
            opt.value = location;
            opt.textContent = location;
            select.appendChild(opt);
        });

        if (currentValue && locations.includes(currentValue)) {
            select.value = currentValue;
        } else {
            this.locationFilter = '';
            select.value = '';
        }
    },

    async handleAddRoom(e) {
        e.preventDefault();
        if (!this.requireAuth('Please sign in as a landlord to add rooms.')) return;
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
                e.target.reset();
                this.showToast('Room created successfully.', 'success');
                this.switchView('rooms');
            } else {
                const data = await res.json().catch(() => null);
                this.showToast(this.getApiError(data, 'Failed to create room. Please check your inputs.'), 'error');
            }
        } catch (err) {
            console.error("Error adding room", err);
            this.showToast('Connection error while creating room.', 'error');
        }
    },

    async loadBookings() {
        if (!this.requireAuth('Please sign in to view bookings.')) return;
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
                            <div style="font-weight: 600; color: var(--primary);">#${this.escapeHTML(b.booking_reference)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(b.created_at).toLocaleDateString()}</div>
                        </td>
                        <td>
                            <div style="font-weight: 500;">${this.escapeHTML(b.room.description.substring(0, 42))}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHTML(b.room.city)} | ${this.formatMoney(b.room.price)}</div>
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

    createBooking(roomId) {
        if (!this.requireAuth('Please sign in before booking a room.')) return;
        if (this.user.role !== 'tenant') {
            this.showToast('Only tenants can book rooms.', 'error');
            return;
        }
        const room = this.roomCache.find(r => Number(r.id) === Number(roomId));
        if (!room) {
            this.showToast('Room details are not available yet. Please refresh the rooms list.', 'error');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('booking-room-id').value = room.id;
        document.getElementById('booking-check-in').value = today;
        document.getElementById('booking-check-in').min = today;
        document.getElementById('booking-special-requests').value = '';
        document.getElementById('booking-payment-reference').value = '';
        document.getElementById('booking-room-summary').innerHTML = `
            <strong>${this.escapeHTML(room.city)}, ${this.escapeHTML(room.state)}</strong>
            <span>${this.escapeHTML(room.location)}</span>
            <b>${this.formatMoney(room.price)}</b>
        `;
        this.toggleModal('booking-modal', true);
    },

    async handleCreateBooking(e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('room', document.getElementById('booking-room-id').value);
        formData.append('check_in', document.getElementById('booking-check-in').value);
        formData.append('special_requests', document.getElementById('booking-special-requests').value.trim());

        const paymentReference = document.getElementById('booking-payment-reference').files[0];
        if (paymentReference) {
            formData.append('payment_reference', paymentReference);
        }

        try {
            const res = await fetch('/api/bookings/create/', {
                method: 'POST',
                headers: { 'Authorization': `Token ${this.token}` },
                body: formData
            });

            if (res.ok) {
                this.toggleModal('booking-modal', false);
                e.target.reset();
                this.showToast('Booking request sent to the landlord.', 'success');
                this.switchView('bookings');
            } else {
                const data = await res.json().catch(() => null);
                this.showToast(this.getApiError(data, 'Booking failed. Please check your request.'), 'error');
            }
        } catch (err) {
            console.error("Error creating booking", err);
            this.showToast('Connection error while sending booking request.', 'error');
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
                this.showToast('Booking updated.', 'success');
                this.loadBookings();
            } else {
                const data = await res.json().catch(() => null);
                this.showToast(this.getApiError(data, 'Failed to update booking status.'), 'error');
            }
        } catch (err) {
            console.error("Error updating booking", err);
            this.showToast('Connection error while updating booking.', 'error');
        }
    },

    async viewBooking(id) {
        if (!this.requireAuth('Please sign in to view booking details.')) return;
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
                        <p>#${this.escapeHTML(b.booking_reference)}</p>
                    </div>
                    <div class="detail-item">
                        <label>Current Status</label>
                        <p><span class="status-tag ${this.escapeHTML(b.status)}">${this.escapeHTML(b.status)}</span></p>
                    </div>
                    <div class="detail-item">
                        <label>Check-in Date</label>
                        <p>${new Date(b.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div class="detail-item">
                        <label>Payment Status</label>
                        <p><span class="status-tag ${this.escapeHTML(b.payment_status)}">${this.escapeHTML(b.payment_status)}</span></p>
                    </div>
                    <div class="detail-item">
                        <label>Room Details</label>
                        <p>${this.escapeHTML(b.room.description)}</p>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHTML(b.room.location)}, ${this.escapeHTML(b.room.city)} | ${this.formatMoney(b.room.price)}</span>
                    </div>
                    <div class="detail-item">
                        <label>${this.user.role === 'landlord' ? 'Tenant' : 'Landlord'} Information</label>
                        <p>${this.escapeHTML(this.user.role === 'landlord' ? b.tenant.username : b.room.landlord?.username || 'Landlord')}</p>
                        <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-phone-alt"></i> ${this.escapeHTML((this.user.role === 'landlord' ? b.tenant.contact_number : b.room.landlord?.contact_number) || 'No contact provided')}</span>
                    </div>
                    <div class="detail-item full-width" style="background: var(--bg-main); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
                        <label>Special Requests</label>
                        <p style="font-style: ${b.special_requests ? 'normal' : 'italic'}; color: ${b.special_requests ? 'inherit' : 'var(--text-muted)'};">
                            ${this.escapeHTML(b.special_requests || 'No special requests submitted.')}
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
            this.showToast('Booking details could not be loaded.', 'error');
        }
    },

    // Chat Logic
    connectChatSocket() {
        if (!this.token || (this.chatSocket && this.chatSocket.readyState <= WebSocket.OPEN)) return;

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        this.chatSocket = new WebSocket(`${protocol}://${window.location.host}/ws/chat/?token=${encodeURIComponent(this.token)}`);

        this.chatSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'chat.message') {
                this.handleIncomingMessage(data.message);
            }
        };

        this.chatSocket.onclose = () => {
            setTimeout(() => this.connectChatSocket(), 2000);
        };

        this.chatSocket.onerror = (error) => {
            console.error("Chat socket error", error);
        };
    },

    async loadConversations() {
        if (!this.requireAuth('Please sign in to use messages.')) return;
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
                <div class="conv-item ${this.activeChatUser === user.id ? 'active' : ''}" onclick="app.selectChatUser(${user.id}, '${this.escapeHTML(user.username)}')">
                    <div class="avatar">${this.escapeHTML(user.username[0].toUpperCase())}</div>
                    <div class="conv-info">
                        <h4>${this.escapeHTML(user.username)}</h4>
                        <p>${this.escapeHTML(user.role)}</p>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error("Chat error", err);
        }
    },

    startChat(userId, username) {
        if (!this.requireAuth('Please sign in to message the landlord.')) return;
        if (Number(userId) === Number(this.user.id)) {
            this.showToast('You cannot message yourself.', 'error');
            return;
        }
        this.switchView('chat');
        this.selectChatUser(userId, username);
    },

    selectChatUser(id, name) {
        console.log("Opening chat with:", name, "ID:", id);
        this.activeChatUser = id;
        this.lastMessageCount = 0;
        this.renderedMessageIds = new Set();
        
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

            this.lastMessageCount = messages.length;
            this.renderedMessageIds = new Set(messages.map(msg => msg.id));

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
                    <div class="message ${Number(msg.sender) === currentUserId ? 'sent' : 'received'}" data-date="${msgDate}">
                        <div class="msg-content">${this.escapeHTML(msg.content)}</div>
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

    handleIncomingMessage(message) {
        const messageSender = Number(message.sender);
        const messageReceiver = Number(message.receiver);
        const currentUserId = this.user ? Number(this.user.id) : 0;
        const activeChatId = Number(this.activeChatUser);
        const belongsToActiveChat = activeChatId && (
            (messageSender === currentUserId && messageReceiver === activeChatId) ||
            (messageSender === activeChatId && messageReceiver === currentUserId)
        );

        this.loadConversations();

        if (!belongsToActiveChat || this.activeView !== 'chat') return;
        if (this.renderedMessageIds.has(message.id)) return;

        const box = document.getElementById('messages-box');
        if (!box) return;

        const emptyState = box.querySelector('.chat-empty');
        if (emptyState) box.innerHTML = '';

        const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 150;
        this.renderedMessageIds.add(message.id);

        const previousMessage = box.querySelector('.message:last-of-type');
        const previousDate = previousMessage ? previousMessage.getAttribute('data-date') : null;
        const messageDate = new Date(message.created_at).toLocaleDateString();
        if (messageDate !== previousDate) {
            const displayDate = messageDate === new Date().toLocaleDateString() ? 'Today' : messageDate;
            box.insertAdjacentHTML('beforeend', `<div class="date-divider"><span>${displayDate}</span></div>`);
        }

        box.insertAdjacentHTML('beforeend', `
            <div class="message ${messageSender === currentUserId ? 'sent' : 'received'}" data-date="${messageDate}">
                <div class="msg-content">${this.escapeHTML(message.content)}</div>
                <span class="time">${new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `);

        if (atBottom || messageSender === currentUserId) {
            box.scrollTop = box.scrollHeight;
        }
    },

    async sendMessage() {
        if (!this.requireAuth('Please sign in to send messages.')) return;
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        
        if (!this.activeChatUser) {
            this.showToast('Select a conversation before sending a message.', 'error');
            return;
        }
        if (Number(this.activeChatUser) === Number(this.user.id)) {
            this.showToast('You cannot message yourself.', 'error');
            return;
        }
        if (!content) return;

        if (this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
            this.chatSocket.send(JSON.stringify({
                type: 'chat.message',
                receiver: this.activeChatUser,
                content: content
            }));
            input.value = '';
            return;
        }

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
            }
        } catch (err) {
            console.error("Send error", err);
        }
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => app.init());
