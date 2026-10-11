/**
 * Main Application Logic & API Connect (CP-2)
 * University Maintenance & Complaint Management System
 */

const API_URL = 'http://localhost:5000/api';

// Cached metadata
let cachedMetadata = {
  buildings: [],
  categories: []
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('Campus Maintenance Portal Loaded [CP-2].');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Highlight active link in navbar
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') && currentPath.endsWith(link.getAttribute('href'))) {
      link.classList.add('active');
    }
  });

  // ================= 1. LOGIN FORM =================
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (response.ok && data.status === 'success') {
          localStorage.setItem('token', data.data.token);
          localStorage.setItem('user', JSON.stringify(data.data.user));
          alert(`Login successful! Welcome, ${data.data.user.name}`);
          window.location.href = 'dashboard.html';
        } else {
          alert(data.message || 'Incorrect email or password.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      } catch (err) {
        console.error('Login error:', err);
        alert('Server connection error! Ensure backend is running (npm run dev).');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }

  // ================= 2. REGISTER FORM =================
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const role = document.getElementById('regRole').value;
      const phone = document.getElementById('regPhone').value.trim();
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';

      try {
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role, phone: phone || null })
        });
        const data = await response.json();

        if (response.ok && data.status === 'success') {
          alert('Registration successful! Please sign in with your new credentials.');
          window.location.href = 'login.html';
        } else {
          alert(data.message || 'Registration failed.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register Account';
        }
      } catch (err) {
        console.error('Register error:', err);
        alert('Server connection error! Ensure backend is running.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Account';
      }
    });
  }

  // ================= 3. MULTI-LOCATION COMPLAINT FORM (CP-2 CORE) =================
  const multiForm = document.getElementById('multiLocationComplaintForm');
  if (multiForm) {
    if (!token || !currentUser) {
      alert('Please log in first to submit a complaint.');
      window.location.href = 'login.html';
      return;
    }

    initMultiLocationForm(token);
  }

  // ================= 4. DASHBOARD PAGE =================
  const isDashboard = window.location.pathname.endsWith('dashboard.html');
  if (isDashboard) {
    if (!token || !currentUser) {
      alert('Please sign in to access the Dashboard.');
      window.location.href = 'login.html';
      return;
    }

    const userNameElem = document.getElementById('userNameDisplay');
    const userRoleElem = document.getElementById('userRoleDisplay');
    if (userNameElem) userNameElem.textContent = currentUser.name;
    if (userRoleElem) userRoleElem.textContent = currentUser.role;

    initDashboard(token, currentUser);
  }

  // ================= 5. LOGOUT =================
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert('You have been signed out.');
      window.location.href = 'login.html';
    });
  }
});

// =========================================================================
// CP-2: DYNAMIC MULTI-LOCATION & ISSUE CATEGORY MANAGEMENT
// =========================================================================

let locationEntries = [];
let locationCounter = 0;

async function initMultiLocationForm(token) {
  const locationsList = document.getElementById('locationsList');
  const btnAddLocation = document.getElementById('btnAddLocation');
  const form = document.getElementById('multiLocationComplaintForm');

  // 1. Fetch metadata from backend
  try {
    const res = await fetch(`${API_URL}/complaints/meta`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const json = await res.json();
      cachedMetadata = json.data;
    }
  } catch (err) {
    console.warn('Metadata fetch failed, using fallback data:', err);
  }

  // Fallback categories if server metadata is empty
  if (!cachedMetadata.categories || cachedMetadata.categories.length === 0) {
    cachedMetadata.categories = [
      { CategoryID: 1, Name: 'Electrical (AC, Fan, Lights, Projector)' },
      { CategoryID: 2, Name: 'IT & Network (Wi-Fi, Lab PC, Router)' },
      { CategoryID: 3, Name: 'Plumbing (Water line, Restroom)' },
      { CategoryID: 4, Name: 'Carpentry & Furniture (Desk, Door, Chair)' }
    ];
  }

  // Fallback buildings & rooms if empty
  if (!cachedMetadata.buildings || cachedMetadata.buildings.length === 0) {
    cachedMetadata.buildings = [
      {
        BuildingID: 1,
        Name: 'Academic Building 1',
        rooms: [{ RoomID: 101, RoomNumber: 'Lab-302' }, { RoomID: 103, RoomNumber: 'Room-204' }]
      },
      {
        BuildingID: 2,
        Name: 'Central Library',
        rooms: [{ RoomID: 102, RoomNumber: 'Reading-Room-A' }]
      }
    ];
  }

  // 2. Add initial location card
  addLocationCard();

  // 3. Add location event listener
  btnAddLocation.addEventListener('click', () => {
    addLocationCard();
  });

  // 4. Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validation: Check all cards
    const payloadItems = [];
    const usedRooms = new Set();

    for (let i = 0; i < locationEntries.length; i++) {
      const entry = locationEntries[i];
      const cardElem = document.getElementById(`loc-card-${entry.id}`);
      if (!cardElem) continue;

      const roomSelect = cardElem.querySelector('.room-select');
      const prioritySelect = cardElem.querySelector('.priority-select');
      const descInput = cardElem.querySelector('.desc-input');

      const roomId = Number(roomSelect.value);
      const priority = prioritySelect.value;
      const description = descInput.value.trim();

      if (!roomId) {
        alert(`Please select a Room / Location for Location #${i + 1}.`);
        roomSelect.focus();
        return;
      }

      if (usedRooms.has(roomId)) {
        alert(`Duplicate room detected! You have selected the same room in multiple location cards.`);
        roomSelect.focus();
        return;
      }
      usedRooms.add(roomId);

      if (entry.categories.length === 0) {
        alert(`Please select at least one Issue Category for Location #${i + 1}.`);
        return;
      }

      if (!description) {
        alert(`Please provide a description of the issue for Location #${i + 1}.`);
        descInput.focus();
        return;
      }

      payloadItems.push({
        roomId,
        categoryIds: entry.categories,
        priority,
        description
      });
    }

    if (payloadItems.length === 0) {
      alert('Please add at least one valid location entry.');
      return;
    }

    const generalDescription = document.getElementById('generalDescription').value.trim();
    const photoUrl = document.getElementById('generalPhotoUrl').value.trim();
    const submitBtn = document.getElementById('btnSubmitAll');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Reports to Database...';

    // Build array-of-objects payload
    const payload = {
      items: payloadItems,
      generalDescription,
      photoUrl: photoUrl || null
    };

    console.log('Submitting CP-2 Payload:', payload);

    try {
      const response = await fetch(`${API_URL}/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        const count = result.data.count || payloadItems.length;
        alert(`🎉 Success! ${count} maintenance complaint(s) successfully recorded in Supabase database.`);
        window.location.href = 'dashboard.html';
      } else {
        alert(result.message || 'Failed to submit complaint reports.');
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit Maintenance Report';
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error submitting report to backend API. Please verify server status.');
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Submit Maintenance Report';
    }
  });
}

function addLocationCard() {
  locationCounter++;
  const entryId = locationCounter;
  const entryState = {
    id: entryId,
    categories: []
  };
  locationEntries.push(entryState);

  const container = document.getElementById('locationsList');
  const card = document.createElement('div');
  card.className = 'location-card';
  card.id = `loc-card-${entryId}`;

  // Render Card HTML
  card.innerHTML = `
    <div class="location-card-header">
      <div class="location-card-title">
        <span>📍 Location Entry</span>
        <span class="location-badge card-number-badge">#${locationEntries.length}</span>
      </div>
      <button type="button" class="btn btn-danger btn-sm btn-remove-location" title="Remove this location">
        ✖ Remove Location
      </button>
    </div>

    <!-- Location / Room Selection -->
    <div class="form-group">
      <label>Location / Room Number <span style="color: var(--danger);">*</span></label>
      <select class="form-control room-select" required>
        <option value="" disabled selected>-- Select Location / Room --</option>
        ${renderRoomOptions()}
      </select>
    </div>

    <!-- Dynamic Issue Categories -->
    <div class="form-group">
      <label>
        Issue Category (Select all that apply) <span style="color: var(--danger);">*</span>
      </label>
      <div class="category-chips-container" id="chips-${entryId}">
        ${renderCategoryChips(entryId)}
      </div>
      <small style="color: var(--text-muted); display: block; margin-top: 4px;">
        Click to toggle multiple categories for this location.
      </small>
    </div>

    <!-- Urgency / Priority -->
    <div class="form-group">
      <label>Urgency Level</label>
      <select class="form-control priority-select" required>
        <option value="LOW">Low (Minor inconvenience)</option>
        <option value="MEDIUM" selected>Medium (Standard maintenance)</option>
        <option value="HIGH">High (Disrupting class / activities)</option>
        <option value="URGENT">Urgent (Safety hazard or complete room outage)</option>
      </select>
    </div>

    <!-- Specific Room Description -->
    <div class="form-group" style="margin-bottom: 0;">
      <label>Issue Description for this Location <span style="color: var(--danger);">*</span></label>
      <textarea 
        class="form-control desc-input" 
        rows="2" 
        placeholder="e.g. Projector power cord sparking and 2 front tube lights dead..."
        required
      ></textarea>
    </div>
  `;

  container.appendChild(card);

  // Attach chip click listeners
  attachChipListeners(card, entryState);

  // Attach remove listener
  const btnRemove = card.querySelector('.btn-remove-location');
  btnRemove.addEventListener('click', () => {
    removeLocationCard(entryId);
  });

  updateLocationNumbers();
}

function removeLocationCard(entryId) {
  if (locationEntries.length <= 1) {
    alert('At least one location entry is required in your maintenance report.');
    return;
  }

  const cardElem = document.getElementById(`loc-card-${entryId}`);
  if (cardElem) cardElem.remove();

  locationEntries = locationEntries.filter(e => e.id !== entryId);
  updateLocationNumbers();
}

function updateLocationNumbers() {
  const cards = document.querySelectorAll('#locationsList .location-card');
  cards.forEach((c, idx) => {
    const badge = c.querySelector('.card-number-badge');
    if (badge) badge.textContent = `#${idx + 1}`;

    const removeBtn = c.querySelector('.btn-remove-location');
    if (removeBtn) {
      removeBtn.style.display = cards.length > 1 ? 'inline-flex' : 'none';
    }
  });
}

function renderRoomOptions() {
  let html = '';
  if (cachedMetadata.buildings && cachedMetadata.buildings.length > 0) {
    cachedMetadata.buildings.forEach(b => {
      html += `<optgroup label="${b.Name}">`;
      if (b.rooms && b.rooms.length > 0) {
        b.rooms.forEach(r => {
          html += `<option value="${r.RoomID}">${b.Name} - ${r.RoomNumber}</option>`;
        });
      }
      html += `</optgroup>`;
    });
  } else {
    html += `<option value="101">Academic Building 1 - Lab-302</option>`;
    html += `<option value="102">Central Library - Reading-Room-A</option>`;
  }
  return html;
}

function renderCategoryChips(entryId) {
  const categories = cachedMetadata.categories || [];
  return categories.map(cat => {
    return `
      <div class="category-chip" data-cat-id="${cat.CategoryID}">
        <span class="check-icon">⬜</span>
        <span>${cat.Name}</span>
      </div>
    `;
  }).join('');
}

function attachChipListeners(cardElem, entryState) {
  const chips = cardElem.querySelectorAll('.category-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const catId = Number(chip.getAttribute('data-cat-id'));
      const isSelected = chip.classList.contains('selected');

      if (isSelected) {
        chip.classList.remove('selected');
        chip.querySelector('.check-icon').textContent = '⬜';
        entryState.categories = entryState.categories.filter(id => id !== catId);
      } else {
        chip.classList.add('selected');
        chip.querySelector('.check-icon').textContent = '✅';
        if (!entryState.categories.includes(catId)) {
          entryState.categories.push(catId);
        }
      }
    });
  });
}

// =========================================================================
// CP-2: DASHBOARD CRUD OPERATIONS (READ, UPDATE, DELETE)
// =========================================================================

let allComplaintsData = [];
let currentFilter = 'ALL';

async function initDashboard(token, currentUser) {
  await loadComplaints(token, currentUser);

  // Refresh button
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadComplaints(token, currentUser));
  }

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderComplaintsTable(token, currentUser);
    });
  });

  // Modal Close buttons
  const editModal = document.getElementById('editModal');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const editForm = document.getElementById('editComplaintForm');

  if (btnModalClose) btnModalClose.addEventListener('click', () => editModal.classList.remove('active'));
  if (btnModalCancel) btnModalCancel.addEventListener('click', () => editModal.classList.remove('active'));

  // Save Edit Complaint Form
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editComplaintId').value;
      const description = document.getElementById('editDescription').value.trim();
      const priority = document.getElementById('editPriority').value;
      const btnSave = document.getElementById('btnSaveEdit');

      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';

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
          alert('Complaint updated successfully!');
          editModal.classList.remove('active');
          await loadComplaints(token, currentUser);
        } else {
          alert(result.message || 'Failed to update complaint.');
        }
      } catch (err) {
        console.error('Update error:', err);
        alert('Server error updating complaint.');
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Save Changes';
      }
    });
  }
}

async function loadComplaints(token, currentUser) {
  const tbody = document.getElementById('complaintsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Connecting to database & loading complaints...</td></tr>';

  let endpoint = `${API_URL}/complaints/my-complaints`;
  const tableTitle = document.getElementById('tableTitle');

  if (currentUser.role === 'ADMIN') {
    endpoint = `${API_URL}/admin/complaints`;
    if (tableTitle) tableTitle.textContent = 'Campus Complaints Registry (Admin Full View)';
  } else if (currentUser.role === 'STAFF') {
    endpoint = `${API_URL}/staff/complaints`;
    if (tableTitle) tableTitle.textContent = 'Assigned Maintenance Tasks';
  }

  try {
    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (!res.ok || result.status !== 'success') {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${result.message || 'Failed to load complaints'}</td></tr>`;
      return;
    }

    allComplaintsData = result.data.complaints || [];

    // Calculate Counts
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;

    allComplaintsData.forEach(c => {
      const s = (c.Status || '').toUpperCase();
      if (s === 'PENDING') pending++;
      else if (s === 'IN_PROGRESS' || s === 'ASSIGNED') inProgress++;
      else if (s === 'RESOLVED') resolved++;
    });

    const statTotal = document.getElementById('statTotal');
    const statPending = document.getElementById('statPending');
    const statInProgress = document.getElementById('statInProgress');
    const statResolved = document.getElementById('statResolved');

    if (statTotal) statTotal.textContent = allComplaintsData.length;
    if (statPending) statPending.textContent = pending;
    if (statInProgress) statInProgress.textContent = inProgress;
    if (statResolved) statResolved.textContent = resolved;

    const countAll = document.getElementById('countAll');
    const countPending = document.getElementById('countPending');
    const countInProgress = document.getElementById('countInProgress');
    const countResolved = document.getElementById('countResolved');

    if (countAll) countAll.textContent = allComplaintsData.length;
    if (countPending) countPending.textContent = pending;
    if (countInProgress) countInProgress.textContent = inProgress;
    if (countResolved) countResolved.textContent = resolved;

    renderComplaintsTable(token, currentUser);

  } catch (err) {
    console.error('Fetch complaints error:', err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to connect to backend server. Make sure npm run dev is running on port 5000.</td></tr>';
  }
}

function renderComplaintsTable(token, currentUser) {
  const tbody = document.getElementById('complaintsTableBody');
  let filtered = allComplaintsData;

  if (currentFilter === 'PENDING') {
    filtered = allComplaintsData.filter(c => (c.Status || '').toUpperCase() === 'PENDING');
  } else if (currentFilter === 'IN_PROGRESS') {
    filtered = allComplaintsData.filter(c => {
      const s = (c.Status || '').toUpperCase();
      return s === 'IN_PROGRESS' || s === 'ASSIGNED';
    });
  } else if (currentFilter === 'RESOLVED') {
    filtered = allComplaintsData.filter(c => (c.Status || '').toUpperCase() === 'RESOLVED');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          No complaints found under filter "<strong>${currentFilter}</strong>". Click <strong><a href="new-complaint.html" style="color: var(--primary-color);">+ Report New Issue</a></strong> to submit.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const status = (c.Status || 'PENDING').toUpperCase();
    const statusBadgeClass = `badge-${status.toLowerCase()}`;
    const location = c.room ? `${c.room.building ? c.room.building.Name + ', ' : ''}${c.room.RoomNumber}` : `Room #${c.RoomID}`;
    const category = c.category ? c.category.Name : `Category #${c.CategoryID}`;
    const date = c.CreatedAt ? new Date(c.CreatedAt).toLocaleDateString() : 'N/A';
    const isPending = status === 'PENDING';

    let actionButtons = '';
    // Student can Edit/Delete if PENDING; Admin can always Edit/Delete
    if ((currentUser.role === 'STUDENT' && isPending) || currentUser.role === 'ADMIN') {
      actionButtons = `
        <button class="btn btn-outline btn-sm btn-edit" data-id="${c.ComplaintID}" title="Edit Description/Priority">✏️ Edit</button>
        <button class="btn btn-danger btn-sm btn-delete" data-id="${c.ComplaintID}" title="Delete/Cancel Complaint">🗑️ Delete</button>
      `;
    } else {
      actionButtons = `<span style="color: var(--text-muted); font-size: 0.8rem;">🔒 Locked</span>`;
    }

    return `
      <tr>
        <td><strong>#${c.ComplaintID}</strong></td>
        <td>${category}</td>
        <td>${location}</td>
        <td>${c.Description}</td>
        <td><strong style="color: ${c.Priority === 'URGENT' || c.Priority === 'HIGH' ? 'var(--danger)' : 'var(--text-dark)'};">${c.Priority || 'MEDIUM'}</strong></td>
        <td><span class="badge ${statusBadgeClass}">${status}</span></td>
        <td>${date}</td>
        <td><div class="actions-cell">${actionButtons}</div></td>
      </tr>
    `;
  }).join('');

  // Attach Edit Listeners
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const complaint = allComplaintsData.find(c => c.ComplaintID === id);
      if (complaint) openEditModal(complaint);
    });
  });

  // Attach Delete Listeners
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      if (confirm(`Are you sure you want to delete / cancel Complaint #${id}?`)) {
        await deleteComplaint(id, token, currentUser);
      }
    });
  });
}

function openEditModal(complaint) {
  const modal = document.getElementById('editModal');
  const idInput = document.getElementById('editComplaintId');
  const metaDisplay = document.getElementById('editComplaintMeta');
  const descInput = document.getElementById('editDescription');
  const prioritySelect = document.getElementById('editPriority');

  idInput.value = complaint.ComplaintID;
  const roomName = complaint.room ? `${complaint.room.building ? complaint.room.building.Name + ' - ' : ''}${complaint.room.RoomNumber}` : `Room #${complaint.RoomID}`;
  const catName = complaint.category ? complaint.category.Name : 'General';
  metaDisplay.textContent = `Complaint #${complaint.ComplaintID} | ${roomName} | ${catName}`;

  descInput.value = complaint.Description || '';
  prioritySelect.value = (complaint.Priority || 'MEDIUM').toUpperCase();

  modal.classList.add('active');
}

async function deleteComplaint(complaintId, token, currentUser) {
  try {
    const res = await fetch(`${API_URL}/complaints/${complaintId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (res.ok && result.status === 'success') {
      alert(`Complaint #${complaintId} has been successfully deleted.`);
      await loadComplaints(token, currentUser);
    } else {
      alert(result.message || 'Failed to delete complaint.');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Server error deleting complaint.');
  }
}
