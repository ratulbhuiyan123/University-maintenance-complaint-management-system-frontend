/**
 * CampusCare — Clean & Simple Frontend Controller (CP-2)
 */

const API_URL = 'http://localhost:5000/api';

// Cached metadata
let cachedMetadata = {
  buildings: [],
  rooms: [],
  categories: []
};

let selectedRoomIds = [];
let selectedCategoryIds = [];
let allComplaints = [];

// ==========================================
// TOAST NOTIFICATION
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');

  toast.innerHTML = `
    <span style="font-size: 1.2rem;">${icon}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Active Navbar Link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') && currentPath.endsWith(link.getAttribute('href'))) {
      link.classList.add('active');
    }
  });

  // User Info & Logout
  const navUserBadge = document.getElementById('navUserBadge');
  if (navUserBadge && currentUser) {
    navUserBadge.style.display = 'inline-block';
    navUserBadge.textContent = `👤 ${currentUser.name || 'User'} (${(currentUser.role || 'STUDENT').toUpperCase()})`;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && token) {
    logoutBtn.textContent = 'Sign Out';
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    });
  }

  // 1. LOGIN
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btn = loginForm.querySelector('button[type="submit"]');

      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Signing in...</span>';

      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          localStorage.setItem('token', data.data.token);
          localStorage.setItem('user', JSON.stringify(data.data.user));
          showToast(`Welcome back, ${data.data.user.name}!`, 'success');
          setTimeout(() => window.location.href = 'dashboard.html', 700);
        } else {
          showToast(data.message || 'Invalid email or password.', 'error');
          btn.disabled = false;
          btn.innerHTML = 'Sign In';
        }
      } catch (err) {
        showToast('Cannot connect to backend server.', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Sign In';
      }
    });
  }

  // 2. REGISTER
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const role = document.getElementById('regRole').value;
      const phone = document.getElementById('regPhone').value.trim();

      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role, phone: phone || null })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          showToast('Account created! Please sign in.', 'success');
          setTimeout(() => window.location.href = 'login.html', 1000);
        } else {
          showToast(data.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showToast('Server connection failed.', 'error');
      }
    });
  }

  // 3. DASHBOARD
  if (document.getElementById('complaintsTableBody')) {
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    if (currentUser) {
      const nameEl = document.getElementById('userNameDisplay');
      const roleEl = document.getElementById('userRoleDisplay');
      if (nameEl) nameEl.textContent = currentUser.name || 'User';
      if (roleEl) roleEl.textContent = (currentUser.role || 'STUDENT').toUpperCase();
    }

    fetchAndDisplayComplaints(token, currentUser);

    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => fetchAndDisplayComplaints(token, currentUser));
    }

    initEditModal(token, currentUser);
  }

  // 4. REPORT FORM (MULTI-ROOM & MULTI-CATEGORY)
  const reportForm = document.getElementById('singleMultiComplaintForm') || document.getElementById('multiLocationComplaintForm');
  if (reportForm) {
    if (!token) {
      showToast('Please log in first.', 'error');
      setTimeout(() => window.location.href = 'login.html', 1000);
      return;
    }
    initReportForm(token, reportForm);
  }
});

// ==========================================
// CLEAN REPORT FORM CONTROLLER (ENHANCED UI WITH 7 FLOORS & SLICING)
// ==========================================
async function initReportForm(token, form) {
  const btnSubmit = document.getElementById('btnSubmitReport') || form.querySelector('button[type="submit"]');
  const btnReset = document.getElementById('btnResetForm');
  const roomGrid = document.getElementById('roomSelectionGrid');
  const catGrid = document.getElementById('categorySelectionGrid');
  const roomFilterPills = document.getElementById('buildingFilterPills');
  const floorFilterPills = document.getElementById('floorFilterPills');
  const roomSearchInput = document.getElementById('roomSearchInput');
  const roomSelectDropdown = document.getElementById('roomSelectDropdown');
  const catSelectDropdown = document.getElementById('catSelectDropdown');
  const btnAddRoomFromSelect = document.getElementById('btnAddRoomFromSelect');
  const btnAddCatFromSelect = document.getElementById('btnAddCatFromSelect');
  const btnRoomViewGrid = document.getElementById('btnRoomViewGrid');
  const btnRoomViewSelect = document.getElementById('btnRoomViewSelect');
  const btnCatViewGrid = document.getElementById('btnCatViewGrid');
  const btnCatViewSelect = document.getElementById('btnCatViewSelect');
  const roomGridModeWrap = document.getElementById('roomGridModeWrap');
  const roomSelectModeWrap = document.getElementById('roomSelectModeWrap');
  const catGridModeWrap = document.getElementById('catGridModeWrap');
  const catSelectModeWrap = document.getElementById('catSelectModeWrap');
  const btnShowMoreRooms = document.getElementById('btnShowMoreRooms');
  const btnShowAllRooms = document.getElementById('btnShowAllRooms');
  const roomSliceCounterText = document.getElementById('roomSliceCounterText');
  const selectedRoomsBar = document.getElementById('selectedRoomsBar');
  const selectedCatsBar = document.getElementById('selectedCatsBar');
  const roomCountEl = document.getElementById('roomSelectedCount');
  const catCountEl = document.getElementById('catSelectedCount');
  const priorityInput = document.getElementById('reportPriority');
  const priorityTiles = document.querySelectorAll('.priority-tile');
  const descEl = document.getElementById('reportDescription');
  const descCountEl = document.getElementById('descCharCount');
  const photoEl = document.getElementById('reportPhotoUrl');
  const photoWrap = document.getElementById('photoPreviewWrap');
  const photoThumb = document.getElementById('photoPreviewThumb');
  const photoText = document.getElementById('photoPreviewUrlText');
  const btnSamplePhoto = document.getElementById('btnSamplePhoto');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');
  const summaryCalcText = document.getElementById('summaryCalculationText');
  const summaryTicketsBadge = document.getElementById('summaryTotalTicketsBadge');

  let activeBuildingFilter = 'ALL';
  let activeFloorFilter = 'ALL';
  let currentRoomSlice = 12; // Slice 12 rooms at a time to prevent UI clutter

  selectedRoomIds = [];
  selectedCategoryIds = [];

  // Helper to extract floor number (1 to 7 or OTHER)
  function getRoomFloor(room) {
    const str = (room.RoomNumber || '').toString();
    const match = str.match(/Room\s*([0-9]{3})/i) || str.match(/([0-9]{3})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 100 && num <= 199) return '1';
      if (num >= 200 && num <= 299) return '2';
      if (num >= 300 && num <= 399) return '3';
      if (num >= 400 && num <= 499) return '4';
      if (num >= 500 && num <= 599) return '5';
      if (num >= 600 && num <= 699) return '6';
      if (num >= 700 && num <= 799) return '7';
    }
    return 'OTHER';
  }

  // Helper to get category icon
  function getCategoryIcon(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('electric') || n.includes('light') || n.includes('fan') || n.includes('switch')) return '⚡';
    if (n.includes('hvac') || n.includes('ac') || n.includes('cool') || n.includes('air')) return '❄️';
    if (n.includes('it') || n.includes('network') || n.includes('wifi') || n.includes('router')) return '💻';
    if (n.includes('multimedia') || n.includes('projector') || n.includes('av') || n.includes('sound')) return '📽️';
    if (n.includes('plumb') || n.includes('washroom') || n.includes('drain')) return '💧';
    if (n.includes('drink') || n.includes('purifier') || n.includes('cooler')) return '🚰';
    if (n.includes('carpent') || n.includes('furniture') || n.includes('chair') || n.includes('desk')) return '🪑';
    if (n.includes('civil') || n.includes('struct') || n.includes('door') || n.includes('window')) return '🚪';
    if (n.includes('elevator') || n.includes('lift')) return '🛗';
    if (n.includes('cctv') || n.includes('security') || n.includes('surveillance')) return '📹';
    if (n.includes('fire') || n.includes('alarm') || n.includes('extinguish')) return '🧯';
    if (n.includes('clean') || n.includes('housekeep') || n.includes('sanitat')) return '🧹';
    if (n.includes('generator') || n.includes('ups') || n.includes('power')) return '🔋';
    return '🛠️';
  }

  // 1. Fetch Metadata from API
  try {
    const res = await fetch(`${API_URL}/complaints/meta`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      cachedMetadata = data.data || {};

      cachedMetadata.rooms = [];
      if (Array.isArray(cachedMetadata.buildings)) {
        cachedMetadata.buildings.forEach(b => {
          if (Array.isArray(b.rooms)) {
            b.rooms.forEach(r => {
              cachedMetadata.rooms.push({
                RoomID: r.RoomID,
                RoomNumber: r.RoomNumber,
                buildingName: b.Name,
                displayName: `${b.Name} — ${r.RoomNumber}`
              });
            });
          }
        });
      }
    }
  } catch (err) {
    console.error('Metadata load error:', err);
  }

  // Fallback defaults with full 7 floors (70+ rooms) if API has fewer
  if (!cachedMetadata.rooms || cachedMetadata.rooms.length < 20) {
    const fallbackRooms = [];
    const floorInfo = [
      { floor: 1, label: 'Ground Floor', names: ['Lecture Hall 1A', 'Physics Lab 1', 'Chemistry Lab', 'Student Affairs', 'Medical Center', 'Classroom 106', 'Seminar Room A', 'Security Control', 'Staff Dining', 'Maintenance Desk'] },
      { floor: 2, label: 'Level 2 (CSE)', names: ['Programming Lab 1', 'Programming Lab 2', 'Lecture Hall 2A', 'Circuit Lab', 'Faculty Room 2', 'Classroom 206', 'Classroom 207', 'NOC Center', 'Hardware Lab', 'Robotics Studio'] },
      { floor: 3, label: 'Level 3 (Software & AI)', names: ['Lecture Hall 3A', 'Classroom 302', 'Classroom 303', 'AI & ML Lab', 'Cyber Security Lab', 'Software Eng Lab', 'VR & Graphics Studio', 'CSE Head Office', 'CSE Lounge', 'Discussion Hall'] },
      { floor: 4, label: 'Level 4 (EEE)', names: ['Power Systems Lab', 'Microprocessor Lab', 'Lecture Hall 4A', 'Classroom 404', 'Classroom 405', 'DSP Lab', 'EEE Head Office', 'Telecom Lab', 'EEE Lounge', 'Graduate Lab'] },
      { floor: 5, label: 'Level 5 (Civil & Arch)', names: ['Materials Lab', 'Hydraulics Lab', 'Lecture Hall 5A', 'Classroom 504', 'Classroom 505', 'GIS Lab', 'Design Studio 1', 'Model Workshop', 'Civil Head Office', 'Civil Lounge'] },
      { floor: 6, label: 'Level 6 (Research & Dean)', names: ['Digital Library', 'Thesis Hall', 'Cloud Computing Lab', 'Classroom 604', 'Classroom 605', 'Big Data Center', 'Dean Office', 'Academic Council', 'Exam Office', 'Server Archive'] },
      { floor: 7, label: 'Level 7 (Executive & Auditorium)', names: ['Grand Auditorium', 'Conference Hall', 'Trustees Board Room', 'VC Secretariat', 'Pro-VC Office', 'Syndicate Room', 'VIP Protocol Wing', 'Media Briefing Room', 'AV Broadcast Room', 'Rooftop Terrace'] }
    ];

    floorInfo.forEach(f => {
      for (let i = 1; i <= 10; i++) {
        const rId = f.floor * 100 + i;
        fallbackRooms.push({
          RoomID: rId,
          RoomNumber: `Room ${rId} — ${f.names[i - 1]} (${f.label})`,
          buildingName: 'Main Academic Building (7 Floors)',
          displayName: `Main Academic — Room ${rId}`
        });
      }
    });

    // Library and sports
    fallbackRooms.push(
      { RoomID: 801, RoomNumber: 'Room 101-LIB — Main Circulation & Info Desk', buildingName: 'Central Library & ICT Complex', displayName: 'Library — Circulation Desk' },
      { RoomID: 802, RoomNumber: 'Room 201-LIB — Central Silent Reading Hall', buildingName: 'Central Library & ICT Complex', displayName: 'Library — Reading Hall' },
      { RoomID: 803, RoomNumber: 'Room 301-LIB — E-Library & Digital Wing', buildingName: 'Central Library & ICT Complex', displayName: 'Library — Digital Wing' },
      { RoomID: 901, RoomNumber: 'Room 101-SAC — Indoor Sports Arena & Gymnasium', buildingName: 'Student Activity & Sports Complex', displayName: 'SAC — Gymnasium' },
      { RoomID: 902, RoomNumber: 'Room 201-SAC — University Clubs Hub', buildingName: 'Student Activity & Sports Complex', displayName: 'SAC — Clubs Hub' }
    );

    cachedMetadata.rooms = fallbackRooms;
  }

  // Fallback categories if fewer than 10
  if (!cachedMetadata.categories || cachedMetadata.categories.length < 10) {
    cachedMetadata.categories = [
      { CategoryID: 1, Name: 'Electrical (Lights, Fans, Switches, Wiring)' },
      { CategoryID: 2, Name: 'HVAC & Air Conditioning (Cooling, Leakage, Filters)' },
      { CategoryID: 3, Name: 'IT & Network (Wi-Fi, LAN, Routers, Speed)' },
      { CategoryID: 4, Name: 'Multimedia & AV (Projectors, Smartboards, Sound, Mics)' },
      { CategoryID: 5, Name: 'Plumbing & Water (Washroom, Taps, Leakage, Drainage)' },
      { CategoryID: 6, Name: 'Drinking Water & Purifiers (Coolers, Filters, Dispensers)' },
      { CategoryID: 7, Name: 'Carpentry & Furniture (Desks, Benches, Chairs, Podiums)' },
      { CategoryID: 8, Name: 'Civil & Structural (Doors, Locks, Windows, Glass, Walls)' },
      { CategoryID: 9, Name: 'Elevator & Lift Maintenance' },
      { CategoryID: 10, Name: 'Security & Surveillance (CCTV, Access Card, Gates)' },
      { CategoryID: 11, Name: 'Fire & Safety Systems (Extinguishers, Alarms, Emergency Lights)' },
      { CategoryID: 12, Name: 'Housekeeping & Sanitation (Deep Cleaning, Pest Control, Waste)' },
      { CategoryID: 13, Name: 'Power Backup & Generator (UPS, Generator, Voltage Stabilizer)' }
    ];
  }

  // 2. View Mode Switcher Handlers
  if (btnRoomViewGrid && btnRoomViewSelect && roomGridModeWrap && roomSelectModeWrap) {
    btnRoomViewGrid.addEventListener('click', () => {
      btnRoomViewGrid.classList.add('active');
      btnRoomViewSelect.classList.remove('active');
      roomGridModeWrap.style.display = 'block';
      roomSelectModeWrap.classList.remove('active');
    });

    btnRoomViewSelect.addEventListener('click', () => {
      btnRoomViewSelect.classList.add('active');
      btnRoomViewGrid.classList.remove('active');
      roomGridModeWrap.style.display = 'none';
      roomSelectModeWrap.classList.add('active');
    });
  }

  if (btnCatViewGrid && btnCatViewSelect && catGridModeWrap && catSelectModeWrap) {
    btnCatViewGrid.addEventListener('click', () => {
      btnCatViewGrid.classList.add('active');
      btnCatViewSelect.classList.remove('active');
      catGridModeWrap.style.display = 'block';
      catSelectModeWrap.classList.remove('active');
    });

    btnCatViewSelect.addEventListener('click', () => {
      btnCatViewSelect.classList.add('active');
      btnCatViewGrid.classList.remove('active');
      catGridModeWrap.style.display = 'none';
      catSelectModeWrap.classList.add('active');
    });
  }

  // 3. Populate Select Dropdowns
  function populateSelectDropdowns() {
    // Room Select Dropdown with Optgroups
    if (roomSelectDropdown) {
      const groups = {
        '1': 'Floor 1 (Ground Floor — Rooms 101 to 110)',
        '2': 'Floor 2 (CSE & Labs — Rooms 201 to 210)',
        '3': 'Floor 3 (Software & AI — Rooms 301 to 310)',
        '4': 'Floor 4 (EEE & Telecom — Rooms 401 to 410)',
        '5': 'Floor 5 (Civil & Arch — Rooms 501 to 510)',
        '6': 'Floor 6 (Research & Dean — Rooms 601 to 610)',
        '7': 'Floor 7 (Executive & Auditorium — Rooms 701 to 710)',
        'OTHER': 'Central Library & Student Complex'
      };

      let html = '<option value="">-- Click to choose a room from directory --</option>';
      Object.keys(groups).forEach(key => {
        const floorRooms = cachedMetadata.rooms.filter(r => getRoomFloor(r) === key);
        if (floorRooms.length > 0) {
          html += `<optgroup label="${groups[key]}">`;
          floorRooms.forEach(r => {
            html += `<option value="${r.RoomID}">${r.RoomNumber}</option>`;
          });
          html += '</optgroup>';
        }
      });
      roomSelectDropdown.innerHTML = html;
    }

    // Category Select Dropdown
    if (catSelectDropdown) {
      let html = '<option value="">-- Click to choose an issue category --</option>';
      cachedMetadata.categories.forEach(cat => {
        const icon = getCategoryIcon(cat.Name);
        html += `<option value="${cat.CategoryID}">${icon} ${cat.Name}</option>`;
      });
      catSelectDropdown.innerHTML = html;
    }
  }

  // Add from Select Buttons
  if (btnAddRoomFromSelect && roomSelectDropdown) {
    btnAddRoomFromSelect.addEventListener('click', () => {
      const val = Number(roomSelectDropdown.value);
      if (!val) {
        showToast('Please select a room from the dropdown first.', 'info');
        return;
      }
      if (!selectedRoomIds.includes(val)) {
        selectedRoomIds.push(val);
        renderRoomGrid();
        updateSelectedRoomsBar();
        updateSummary();
        showToast('Room added to selection.', 'success');
      } else {
        showToast('This room is already selected.', 'info');
      }
      roomSelectDropdown.value = '';
    });
  }

  if (btnAddCatFromSelect && catSelectDropdown) {
    btnAddCatFromSelect.addEventListener('click', () => {
      const val = Number(catSelectDropdown.value);
      if (!val) {
        showToast('Please select a category from the dropdown first.', 'info');
        return;
      }
      if (!selectedCategoryIds.includes(val)) {
        selectedCategoryIds.push(val);
        renderCategoryGrid();
        updateSelectedCatsBar();
        updateSummary();
        showToast('Category added to selection.', 'success');
      } else {
        showToast('This category is already selected.', 'info');
      }
      catSelectDropdown.value = '';
    });
  }

  // 4. Render Building Filter Tabs
  function renderBuildingFilters() {
    if (!roomFilterPills) return;
    const buildings = Array.from(new Set(cachedMetadata.rooms.map(r => r.buildingName || 'Main Campus')));
    let html = `<button type="button" class="building-pill ${activeBuildingFilter === 'ALL' ? 'active' : ''}" data-bldg="ALL">🏢 All Buildings</button>`;
    buildings.forEach(b => {
      html += `<button type="button" class="building-pill ${activeBuildingFilter === b ? 'active' : ''}" data-bldg="${b}">🏛️ ${b}</button>`;
    });
    roomFilterPills.innerHTML = html;

    roomFilterPills.querySelectorAll('.building-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeBuildingFilter = pill.getAttribute('data-bldg');
        currentRoomSlice = 12; // Reset slice on filter change
        roomFilterPills.querySelectorAll('.building-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderRoomGrid();
      });
    });
  }

  // 5. Floor Filter Pill Handlers
  if (floorFilterPills) {
    floorFilterPills.querySelectorAll('.floor-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeFloorFilter = pill.getAttribute('data-floor');
        currentRoomSlice = 12; // Reset slice on floor change
        floorFilterPills.querySelectorAll('.floor-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderRoomGrid();
      });
    });
  }

  // 6. Render Room Grid with Slicing & Search
  function renderRoomGrid() {
    if (!roomGrid) return;
    const query = (roomSearchInput ? roomSearchInput.value : '').toLowerCase().trim();

    const filtered = cachedMetadata.rooms.filter(room => {
      const matchBldg = (activeBuildingFilter === 'ALL') || (room.buildingName === activeBuildingFilter);
      const matchFloor = (activeFloorFilter === 'ALL') || (getRoomFloor(room) === activeFloorFilter);
      const matchSearch = !query || 
        (room.RoomNumber && room.RoomNumber.toLowerCase().includes(query)) ||
        (room.displayName && room.displayName.toLowerCase().includes(query)) ||
        (room.buildingName && room.buildingName.toLowerCase().includes(query));
      return matchBldg && matchFloor && matchSearch;
    });

    // Update slicing counter & controls
    const totalFiltered = filtered.length;
    const visibleRooms = filtered.slice(0, currentRoomSlice);

    if (roomSliceCounterText) {
      if (totalFiltered === 0) {
        roomSliceCounterText.textContent = 'No matching rooms';
      } else {
        roomSliceCounterText.textContent = `Showing 1–${Math.min(currentRoomSlice, totalFiltered)} of ${totalFiltered} rooms`;
      }
    }

    if (btnShowMoreRooms) {
      btnShowMoreRooms.style.display = (currentRoomSlice < totalFiltered) ? 'inline-block' : 'none';
    }

    if (filtered.length === 0) {
      roomGrid.innerHTML = '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-dim);">No rooms match your search and filter criteria.</div>';
      return;
    }

    roomGrid.innerHTML = visibleRooms.map(room => {
      const isSelected = selectedRoomIds.includes(room.RoomID);
      const floorNum = getRoomFloor(room);
      const floorTag = floorNum !== 'OTHER' ? `Floor ${floorNum}` : 'Campus Wing';
      return `
        <div class="room-card-select ${isSelected ? 'selected' : ''}" data-id="${room.RoomID}">
          <div class="room-card-info">
            <span class="room-card-num">${room.RoomNumber}</span>
            <span class="room-card-bldg">${room.buildingName || 'Main Campus'} &bull; ${floorTag}</span>
          </div>
          <div class="room-check-badge">${isSelected ? '✓' : ''}</div>
        </div>
      `;
    }).join('');

    roomGrid.querySelectorAll('.room-card-select').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.getAttribute('data-id'));
        const idx = selectedRoomIds.indexOf(id);
        if (idx > -1) {
          selectedRoomIds.splice(idx, 1);
        } else {
          selectedRoomIds.push(id);
        }
        renderRoomGrid();
        updateSelectedRoomsBar();
        updateSummary();
      });
    });
  }

  // Slicing buttons
  if (btnShowMoreRooms) {
    btnShowMoreRooms.addEventListener('click', () => {
      currentRoomSlice += 12;
      renderRoomGrid();
    });
  }

  if (btnShowAllRooms) {
    btnShowAllRooms.addEventListener('click', () => {
      currentRoomSlice = 999;
      renderRoomGrid();
    });
  }

  // 7. Update Selected Rooms Chips Bar
  function updateSelectedRoomsBar() {
    if (roomCountEl) {
      roomCountEl.textContent = `${selectedRoomIds.length} selected`;
    }

    if (!selectedRoomsBar) return;

    if (selectedRoomIds.length === 0) {
      selectedRoomsBar.innerHTML = '<span style="color: var(--text-dim); font-size: 0.82rem;">No rooms selected yet. Click rooms or choose from select option above.</span>';
      return;
    }

    let html = selectedRoomIds.map(id => {
      const room = cachedMetadata.rooms.find(r => r.RoomID === id);
      const label = room ? `${room.RoomNumber}` : `Room #${id}`;
      return `
        <span class="selected-tag-chip" data-id="${id}">
          📍 ${label}
          <span class="selected-tag-remove" data-id="${id}">&times;</span>
        </span>
      `;
    }).join('');

    html += `
      <button type="button" id="btnClearRooms" style="margin-left: auto; background: none; border: none; color: var(--text-dim); font-size: 0.78rem; cursor: pointer; text-decoration: underline;">
        Clear rooms
      </button>
    `;

    selectedRoomsBar.innerHTML = html;

    selectedRoomsBar.querySelectorAll('.selected-tag-remove').forEach(rm => {
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(rm.getAttribute('data-id'));
        const idx = selectedRoomIds.indexOf(id);
        if (idx > -1) selectedRoomIds.splice(idx, 1);
        renderRoomGrid();
        updateSelectedRoomsBar();
        updateSummary();
      });
    });

    const btnClearRooms = document.getElementById('btnClearRooms');
    if (btnClearRooms) {
      btnClearRooms.addEventListener('click', () => {
        selectedRoomIds = [];
        renderRoomGrid();
        updateSelectedRoomsBar();
        updateSummary();
      });
    }
  }

  // 8. Render Category Tiles Grid
  function renderCategoryGrid() {
    if (!catGrid) return;

    catGrid.innerHTML = cachedMetadata.categories.map(cat => {
      const isSelected = selectedCategoryIds.includes(cat.CategoryID);
      const icon = getCategoryIcon(cat.Name);
      return `
        <div class="category-card-select ${isSelected ? 'selected' : ''}" data-id="${cat.CategoryID}">
          <div class="category-icon-box">${icon}</div>
          <div class="category-card-name">${cat.Name}</div>
          <div class="room-check-badge">${isSelected ? '✓' : ''}</div>
        </div>
      `;
    }).join('');

    catGrid.querySelectorAll('.category-card-select').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.getAttribute('data-id'));
        const idx = selectedCategoryIds.indexOf(id);
        if (idx > -1) {
          selectedCategoryIds.splice(idx, 1);
        } else {
          selectedCategoryIds.push(id);
        }
        renderCategoryGrid();
        updateSelectedCatsBar();
        updateSummary();
      });
    });
  }

  // 9. Update Selected Categories Chips Bar
  function updateSelectedCatsBar() {
    if (catCountEl) {
      catCountEl.textContent = `${selectedCategoryIds.length} selected`;
    }

    if (!selectedCatsBar) return;

    if (selectedCategoryIds.length === 0) {
      selectedCatsBar.innerHTML = '<span style="color: var(--text-dim); font-size: 0.82rem;">No categories selected yet. Click cards or use dropdown above.</span>';
      return;
    }

    let html = selectedCategoryIds.map(id => {
      const cat = cachedMetadata.categories.find(c => c.CategoryID === id);
      const name = cat ? cat.Name : `Category #${id}`;
      return `
        <span class="selected-tag-chip cat" data-id="${id}">
          🏷️ ${name}
          <span class="selected-tag-remove" data-id="${id}">&times;</span>
        </span>
      `;
    }).join('');

    html += `
      <button type="button" id="btnClearCats" style="margin-left: auto; background: none; border: none; color: var(--text-dim); font-size: 0.78rem; cursor: pointer; text-decoration: underline;">
        Clear categories
      </button>
    `;

    selectedCatsBar.innerHTML = html;

    selectedCatsBar.querySelectorAll('.selected-tag-remove').forEach(rm => {
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(rm.getAttribute('data-id'));
        const idx = selectedCategoryIds.indexOf(id);
        if (idx > -1) selectedCategoryIds.splice(idx, 1);
        renderCategoryGrid();
        updateSelectedCatsBar();
        updateSummary();
      });
    });

    const btnClearCats = document.getElementById('btnClearCats');
    if (btnClearCats) {
      btnClearCats.addEventListener('click', () => {
        selectedCategoryIds = [];
        renderCategoryGrid();
        updateSelectedCatsBar();
        updateSummary();
      });
    }
  }

  // 10. Priority Tiles Selection
  priorityTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      priorityTiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      if (priorityInput) {
        priorityInput.value = tile.getAttribute('data-priority');
      }
    });
  });

  // 11. Description Helpers & Character Counter
  if (descEl && descCountEl) {
    descEl.addEventListener('input', () => {
      descCountEl.textContent = `${descEl.value.length} / 500`;
    });
  }

  document.querySelectorAll('.quick-phrase-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const phrase = chip.getAttribute('data-phrase');
      if (!descEl) return;
      if (descEl.value.trim().length > 0) {
        descEl.value = descEl.value.trim() + ' — ' + phrase;
      } else {
        descEl.value = phrase;
      }
      descEl.dispatchEvent(new Event('input'));
      descEl.focus();
    });
  });

  // 12. Photo Preview & Sample Photo
  function handlePhotoPreview(url) {
    if (!photoWrap || !photoThumb || !photoText) return;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      photoThumb.src = url;
      photoText.textContent = url.length > 45 ? url.substring(0, 42) + '...' : url;
      photoWrap.classList.add('visible');
    } else {
      photoWrap.classList.remove('visible');
      photoThumb.src = '';
      photoText.textContent = '';
    }
  }

  if (photoEl) {
    photoEl.addEventListener('input', () => handlePhotoPreview(photoEl.value.trim()));
  }

  if (btnSamplePhoto && photoEl) {
    btnSamplePhoto.addEventListener('click', () => {
      const sampleUrl = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80';
      photoEl.value = sampleUrl;
      handlePhotoPreview(sampleUrl);
      showToast('Sample photo URL inserted.', 'info');
    });
  }

  if (btnRemovePhoto && photoEl) {
    btnRemovePhoto.addEventListener('click', () => {
      photoEl.value = '';
      handlePhotoPreview('');
    });
  }

  // 13. Summary Calculation
  function updateSummary() {
    const rCount = selectedRoomIds.length;
    const cCount = selectedCategoryIds.length;
    const total = rCount * cCount;

    if (summaryTicketsBadge) {
      summaryTicketsBadge.textContent = `${total} Ticket${total === 1 ? '' : 's'}`;
    }

    if (summaryCalcText) {
      if (total === 0) {
        summaryCalcText.textContent = 'Select at least 1 room and 1 category to generate tickets.';
      } else {
        summaryCalcText.innerHTML = `
          Logging <strong>${rCount} room${rCount === 1 ? '' : 's'}</strong> &times; 
          <strong>${cCount} category${cCount === 1 ? '' : 'ies'}</strong> = 
          <span style="color: var(--primary-light); font-weight: 700;">${total} maintenance ticket${total === 1 ? '' : 's'}</span> will be created.
        `;
      }
    }
  }

  // Search Input Handler (resets slice on search)
  if (roomSearchInput) {
    roomSearchInput.addEventListener('input', () => {
      currentRoomSlice = 12;
      renderRoomGrid();
    });
  }

  // Reset Form
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      selectedRoomIds = [];
      selectedCategoryIds = [];
      if (descEl) descEl.value = '';
      if (descCountEl) descCountEl.textContent = '0 / 500';
      if (photoEl) photoEl.value = '';
      handlePhotoPreview('');
      priorityTiles.forEach(t => t.classList.remove('selected'));
      const medTile = document.querySelector('.priority-tile[data-priority="MEDIUM"]');
      if (medTile) medTile.classList.add('selected');
      if (priorityInput) priorityInput.value = 'MEDIUM';
      currentRoomSlice = 12;
      renderRoomGrid();
      updateSelectedRoomsBar();
      renderCategoryGrid();
      updateSelectedCatsBar();
      updateSummary();
      showToast('Form has been cleared.', 'info');
    });
  }

  // Initial Renders
  populateSelectDropdowns();
  renderBuildingFilters();
  renderRoomGrid();
  updateSelectedRoomsBar();
  renderCategoryGrid();
  updateSelectedCatsBar();
  updateSummary();

  // 14. SUBMIT HANDLER
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedRoomIds.length === 0) {
      showToast('Please select at least one Room / Location.', 'error');
      const step1 = document.querySelector('.report-step-card');
      if (step1) step1.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (selectedCategoryIds.length === 0) {
      showToast('Please select at least one Issue Category.', 'error');
      const step2 = document.querySelectorAll('.report-step-card')[1];
      if (step2) step2.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const priority = priorityInput ? priorityInput.value : 'MEDIUM';
    const description = descEl ? descEl.value.trim() : '';
    const photoUrl = photoEl ? photoEl.value.trim() : '';

    if (!description) {
      showToast('Please provide an issue description.', 'error');
      if (descEl) descEl.focus();
      return;
    }

    // Build items payload
    const items = selectedRoomIds.map(roomId => ({
      roomId: Number(roomId),
      categoryIds: selectedCategoryIds.map(Number),
      priority,
      description,
      photoUrl: photoUrl || null
    }));

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>⏳ Submitting Tickets...</span>';

    try {
      const res = await fetch(`${API_URL}/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items,
          photoUrl: photoUrl || null,
          generalDescription: description
        })
      });

      const result = await res.json();

      if (res.ok && result.status === 'success') {
        const total = selectedRoomIds.length * selectedCategoryIds.length;
        showToast(`🎉 Successfully created ${total} maintenance ticket(s)!`, 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
      } else {
        const errorMsg = result.message || 'Submission failed. Please check form data.';
        showToast(errorMsg, 'error');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '🚀 Submit Maintenance Report';
      }
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Server connection failed. Is backend running?', 'error');
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '🚀 Submit Maintenance Report';
    }
  });
}

// ==========================================
// DASHBOARD CONTROLLER (CRUD)
// ==========================================
async function fetchAndDisplayComplaints(token, currentUser) {
  const tbody = document.getElementById('complaintsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">Loading complaints...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/complaints`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (res.ok && result.status === 'success') {
      allComplaints = result.data.complaints || [];
      updateDashboardStats(allComplaints);
      renderComplaintsTable(allComplaints, token, currentUser);
      initSearchAndFilter(allComplaints, token, currentUser);
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">${result.message || 'Error'}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Backend server disconnected</td></tr>';
  }
}

function updateDashboardStats(complaints) {
  const total = complaints.length;
  const pending = complaints.filter(c => (c.Status || '').toUpperCase() === 'PENDING').length;
  const inProgress = complaints.filter(c => (c.Status || '').toUpperCase() === 'IN_PROGRESS' || (c.Status || '').toUpperCase() === 'ASSIGNED').length;
  const resolved = complaints.filter(c => (c.Status || '').toUpperCase() === 'RESOLVED').length;

  const elTotal = document.getElementById('statTotal');
  const elPending = document.getElementById('statPending');
  const elProgress = document.getElementById('statInProgress');
  const elResolved = document.getElementById('statResolved');

  if (elTotal) elTotal.textContent = total;
  if (elPending) elPending.textContent = pending;
  if (elProgress) elProgress.textContent = inProgress;
  if (elResolved) elResolved.textContent = resolved;

  const cAll = document.getElementById('countAll');
  const cPend = document.getElementById('countPending');
  const cProg = document.getElementById('countInProgress');
  const cRes = document.getElementById('countResolved');

  if (cAll) cAll.textContent = total;
  if (cPend) cPend.textContent = pending;
  if (cProg) cProg.textContent = inProgress;
  if (cRes) cRes.textContent = resolved;
}

function initSearchAndFilter(complaints, token, currentUser) {
  const searchInput = document.getElementById('complaintSearchInput');
  const pills = document.querySelectorAll('.filter-pill');
  let currentFilter = 'ALL';

  function applyFilter() {
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    
    const filtered = complaints.filter(c => {
      const status = (c.Status || '').toUpperCase();
      const matchesFilter = (currentFilter === 'ALL') || 
        (currentFilter === 'PENDING' && status === 'PENDING') ||
        (currentFilter === 'IN_PROGRESS' && (status === 'IN_PROGRESS' || status === 'ASSIGNED')) ||
        (currentFilter === 'RESOLVED' && status === 'RESOLVED');

      if (!matchesFilter) return false;
      if (!q) return true;

      const roomName = c.room ? `${c.room.building ? c.room.building.Name : ''} ${c.room.RoomNumber}`.toLowerCase() : '';
      const catName = c.category ? c.category.Name.toLowerCase() : '';
      const desc = (c.Description || '').toLowerCase();
      const id = String(c.ComplaintID);

      return roomName.includes(q) || catName.includes(q) || desc.includes(q) || id.includes(q);
    });

    renderComplaintsTable(filtered, token, currentUser);
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
  }

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      applyFilter();
    });
  });
}

function renderComplaintsTable(complaints, token, currentUser) {
  const tbody = document.getElementById('complaintsTableBody');
  if (!tbody) return;

  if (complaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
          <p>No maintenance reports found.</p>
          <a href="new-complaint.html" class="btn btn-outline btn-sm" style="margin-top: 10px;">+ Create Report</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = complaints.map(c => {
    const status = (c.Status || 'PENDING').toUpperCase();
    let badgeClass = 'badge-pending';
    if (status === 'IN_PROGRESS' || status === 'ASSIGNED') badgeClass = 'badge-in-progress';
    if (status === 'RESOLVED') badgeClass = 'badge-resolved';

    const location = c.room ? `${c.room.building ? c.room.building.Name + ' — ' : ''}Room ${c.room.RoomNumber}` : `Room #${c.RoomID}`;
    const category = c.category ? c.category.Name : 'General';
    const date = c.CreatedAt ? new Date(c.CreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    let actionBtns = '';
    if (status === 'PENDING') {
      actionBtns = `
        <button class="btn btn-outline btn-sm btn-edit-ticket" data-id="${c.ComplaintID}" title="Edit Ticket">✏️ Edit</button>
        <button class="btn btn-danger btn-sm btn-delete-ticket" data-id="${c.ComplaintID}" title="Delete Ticket">🗑️ Delete</button>
      `;
    } else {
      actionBtns = '<span style="color: var(--text-dim); font-size: 0.8rem;">Locked</span>';
    }

    return `
      <tr>
        <td><strong style="color: #ffffff;">#${c.ComplaintID}</strong></td>
        <td>${category}</td>
        <td><span style="color: #ffffff; font-weight: 500;">${location}</span></td>
        <td style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.Description}">${c.Description}</td>
        <td><strong style="color: ${c.Priority === 'URGENT' || c.Priority === 'HIGH' ? 'var(--danger)' : 'var(--text-secondary)'};">${c.Priority || 'MEDIUM'}</strong></td>
        <td><span class="badge-glass ${badgeClass}">${status}</span></td>
        <td style="color: var(--text-muted);">${date}</td>
        <td><div style="display: flex; gap: 6px;">${actionBtns}</div></td>
      </tr>
    `;
  }).join('');

  // Edit Listeners
  tbody.querySelectorAll('.btn-edit-ticket').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const item = allComplaints.find(c => c.ComplaintID === id);
      if (item) openEditModal(item);
    });
  });

  // Delete Listeners
  tbody.querySelectorAll('.btn-delete-ticket').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      if (confirm(`Delete Ticket #${id}? This operation cannot be undone.`)) {
        await executeDeleteComplaint(id, token, currentUser);
      }
    });
  });
}

function initEditModal(token, currentUser) {
  const modal = document.getElementById('editModal');
  const btnClose = document.getElementById('btnModalClose');
  const btnCancel = document.getElementById('btnModalCancel');
  const form = document.getElementById('editComplaintForm');

  if (!modal) return;

  function closeModal() {
    modal.classList.remove('active');
  }

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editComplaintId').value;
      const description = document.getElementById('editDescription').value.trim();
      const priority = document.getElementById('editPriority').value;

      try {
        const res = await fetch(`${API_URL}/complaints/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ description, priority })
        });
        const result = await res.json();

        if (res.ok && result.status === 'success') {
          showToast(`Ticket #${id} updated successfully!`, 'success');
          closeModal();
          await fetchAndDisplayComplaints(token, currentUser);
        } else {
          showToast(result.message || 'Update failed.', 'error');
        }
      } catch (err) {
        showToast('Server error while saving changes.', 'error');
      }
    });
  }
}

function openEditModal(c) {
  const modal = document.getElementById('editModal');
  document.getElementById('editComplaintId').value = c.ComplaintID;
  const roomName = c.room ? `${c.room.building ? c.room.building.Name + ' — ' : ''}${c.room.RoomNumber}` : `Room #${c.RoomID}`;
  const catName = c.category ? c.category.Name : 'General';
  document.getElementById('editComplaintMeta').textContent = `Ticket #${c.ComplaintID} | ${roomName} | ${catName}`;
  document.getElementById('editDescription').value = c.Description || '';
  document.getElementById('editPriority').value = (c.Priority || 'MEDIUM').toUpperCase();

  modal.classList.add('active');
}

async function executeDeleteComplaint(id, token, currentUser) {
  try {
    const res = await fetch(`${API_URL}/complaints/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (res.ok && result.status === 'success') {
      showToast(`Ticket #${id} deleted successfully.`, 'success');
      await fetchAndDisplayComplaints(token, currentUser);
    } else {
      showToast(result.message || 'Deletion failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to delete ticket.', 'error');
  }
}
