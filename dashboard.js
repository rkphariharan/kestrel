// dashboard.js — Manager view logic

let activePanel = 'overview';
let modalMemberIds = []; // Array for multiple members
let modalTypeId = null;
let modalDate = null;
let modalSlot = null;
let modalYear, modalMonth;
let bufferValues = {};

window.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  const user = localStorage.getItem('kestrel_user');
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  applyTheme(getTheme());
  syncDarkModeToggle();
  initBufferValues();
  renderSidebarTeam();
  renderOverview();
  renderBufferPanel();
  renderTeamPanel();
  renderMySchedule();
  
  const manager = getManager();
  document.getElementById('dashGreeting').textContent = `${greeting()}, ${manager.name.split(' ')[0]} 👋`;
  
  // Update manager badge
  const badge = document.querySelector('.manager-badge');
  if (badge) {
    badge.innerHTML = `
      <div class="mgr-avatar">${manager.avatar}</div>
      <span>${manager.name}</span>
      <span class="mgr-role">${manager.role}</span>
    `;
  }
  
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('dashDateLabel').textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
});

// Listen for storage changes (cross-tab live updates)
window.addEventListener('storage', () => {
  renderOverview();
  renderMySchedule();
  renderTeamPanel();
});

function syncDarkModeToggle() {
  const cb = document.getElementById('darkModeToggle');
  if (cb) cb.checked = getTheme() === 'dark';
}

function initBufferValues() {
  MEETING_TYPES.forEach(mt => { bufferValues[mt.id] = mt.buffer; });
}

// ===== PANELS =====
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`panel-${name}`).style.display = 'block';
  document.querySelectorAll('.sidebar-link').forEach(l => {
    if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(`'${name}'`)) l.classList.add('active');
  });
  activePanel = name;
  if (name === 'overview') renderOverview();
  if (name === 'schedule') renderMySchedule();
  if (name === 'team') renderTeamPanel();
  if (name === 'settings') syncDarkModeToggle();
}

// ===== SIDEBAR TEAM =====
function renderSidebarTeam() {
  const el = document.getElementById('sidebarTeam');
  const team = getTeam();
  el.innerHTML = team.map(m => `
    <div class="sidebar-member" onclick="focusMember('${m.id}')">
      <div class="sm-avatar" style="background:${m.color}">${m.avatar}</div>
      <div class="sm-info">
        <span class="sm-name">${m.name}</span>
        <span class="sm-role">${m.role}</span>
      </div>
      <span class="sm-count" id="sm-count-${m.id}">0</span>
    </div>
  `).join('');
  updateSidebarCounts();
}

function updateSidebarCounts() {
  const today = todayStr();
  const team = getTeam();
  team.forEach(m => {
    const bookings = getBookingsForMember(m.id, today);
    const count = bookings.length;
    const el = document.getElementById(`sm-count-${m.id}`);
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

function focusMember(memberId) {
  showPanel('overview');
  setTimeout(() => {
    const card = document.getElementById(`team-card-${memberId}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ===== OVERVIEW =====
function renderOverview() {
  renderStats();
  renderTeamGrid();
  updateSidebarCounts();
}

function renderStats() {
  const today = todayStr();
  const team = getTeam();
  const allBookings = team.flatMap(m => getBookingsForMember(m.id, today));
  const totalMeetings = allBookings.length;
  const totalBuffer = allBookings.reduce((sum, b) => sum + b.buffer, 0);
  const el = document.getElementById('dashStats');
  el.innerHTML = `
    <div class="dash-stat-card">
      <div class="dsc-icon purple"><i class="fa-regular fa-calendar-check"></i></div>
      <div class="dsc-info"><span class="dsc-num">${totalMeetings}</span><span class="dsc-label">Team Meetings Today</span></div>
    </div>
    <div class="dash-stat-card">
      <div class="dsc-icon orange"><i class="fa-solid fa-shield-halved"></i></div>
      <div class="dsc-info"><span class="dsc-num">${totalBuffer} min</span><span class="dsc-label">Buffer Protected</span></div>
    </div>
    <div class="dash-stat-card">
      <div class="dsc-icon green"><i class="fa-solid fa-users"></i></div>
      <div class="dsc-info"><span class="dsc-num">${team.length}</span><span class="dsc-label">Team Members</span></div>
    </div>
    <div class="dash-stat-card">
      <div class="dsc-icon blue"><i class="fa-solid fa-clock-rotate-left"></i></div>
      <div class="dsc-info"><span class="dsc-num">${getBookings().length}</span><span class="dsc-label">Total Bookings</span></div>
    </div>
  `;
}

function renderTeamGrid() {
  const today = todayStr();
  const el = document.getElementById('teamGrid');
  const team = getTeam();
  el.innerHTML = team.map(m => {
    const bookings = getBookingsForMember(m.id, today)
      .sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM));
    return `
      <div class="team-card" id="team-card-${m.id}">
        <div class="tc-header">
          <div class="tc-avatar" style="background:${m.color}">${m.avatar}</div>
          <div class="tc-info">
            <span class="tc-name">${m.name}</span>
            <span class="tc-role">${m.role}</span>
          </div>
          <span class="tc-count">${bookings.length} meeting${bookings.length !== 1 ? 's' : ''} today</span>
        </div>
        <div class="tc-timeline">
          ${bookings.length === 0
            ? '<div class="tc-empty">No meetings today — fully available</div>'
            : bookings.map(b => `
              <div class="tc-slot">
                <span class="tc-time">${fmt(b.startH)}:${fmt(b.startM)}</span>
                <div class="tc-slot-info">
                  <span class="tc-slot-title">${b.type} · ${b.guestName}</span>
                  <span class="tc-slot-meta">${b.duration} min + ${b.buffer} min buffer</span>
                </div>
                <span class="tc-slot-tag">${fmt(b.startH)}:${fmt(b.startM)}–${fmt(Math.floor((b.startH*60+b.startM+b.duration)/60))}:${fmt((b.startH*60+b.startM+b.duration)%60)}</span>
              </div>
              <div class="tc-buffer-row">
                <i class="fa-solid fa-shield-halved"></i>
                <span>${fmt(Math.floor((b.startH*60+b.startM+b.duration)/60))}:${fmt((b.startH*60+b.startM+b.duration)%60)} – ${fmt(Math.floor((b.startH*60+b.startM+b.duration+b.buffer)/60))}:${fmt((b.startH*60+b.startM+b.duration+b.buffer)%60)} buffer protected</span>
              </div>
            `).join('')
          }
        </div>
        <button class="btn-ghost tc-book-btn" onclick="openBookModalFor('${m.id}')">
          <i class="fa-solid fa-plus"></i> Book for ${m.name.split(' ')[0]}
        </button>
      </div>
    `;
  }).join('');
}

// ===== MY SCHEDULE =====
function renderMySchedule() {
  const today = todayStr();
  const el = document.getElementById('myScheduleTimeline');
  if (!el) return;
  const team = getTeam();
  const allBookings = team.flatMap(m =>
    getBookingsForMember(m.id, today).map(b => ({ ...b, memberName: m.name, color: m.color }))
  ).sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM));

  if (allBookings.length === 0) {
    el.innerHTML = '<div class="tc-empty" style="padding:24px">No meetings booked today yet.</div>';
    return;
  }
  el.innerHTML = allBookings.map(b => `
    <div class="tl-item">
      <span class="tl-time">${fmt(b.startH)}:${fmt(b.startM)}</span>
      <span class="tl-dot booked" style="background:${b.color}"></span>
      <div class="tl-content">
        <div class="tl-title">${b.type} · ${b.guestName}</div>
        <div class="tl-meta">${b.memberName} · ${b.duration} min</div>
      </div>
      <span class="tl-tag booked">Confirmed</span>
    </div>
    <div class="tl-item buffer-tl">
      <span class="tl-time">${fmt(Math.floor((b.startH*60+b.startM+b.duration)/60))}:${fmt((b.startH*60+b.startM+b.duration)%60)}</span>
      <span class="tl-dot buffer"></span>
      <div class="tl-content">
        <div class="tl-title"><i class="fa-solid fa-shield-halved"></i> Buffer protected</div>
        <div class="tl-meta">${b.buffer} min recovery for ${b.memberName}</div>
      </div>
      <span class="tl-tag buffer">Buffer</span>
    </div>
  `).join('');
}

// ===== TEAM PANEL =====
function renderTeamPanel() {
  const today = todayStr();
  const el = document.getElementById('teamList');
  if (!el) return;
  const team = getTeam();
  
  if (team.length === 0) {
    el.innerHTML = `
      <div class="tc-empty" style="padding:24px; text-align:center;">
        <i class="fa-solid fa-users" style="font-size:32px; color:var(--text3); margin-bottom:12px;"></i>
        <div style="font-size:14px; color:var(--text2); margin-bottom:8px;">No team members yet</div>
        <div style="font-size:12px; color:var(--text3); margin-bottom:16px;">Add your first team member to get started</div>
        <button class="btn-primary" onclick="openAddMemberModal()"><i class="fa-solid fa-plus"></i> Add First Team Member</button>
      </div>
    `;
    return;
  }
  
  el.innerHTML = team.map(m => {
    const bookings = getBookingsForMember(m.id, today);
    return `
      <div class="team-list-row">
        <div class="tlr-avatar" style="background:${m.color}">${m.avatar}</div>
        <div class="tlr-info">
          <span class="tlr-name">${m.name}</span>
          <span class="tlr-role">${m.role}</span>
          <span style="font-size:11px; color:var(--text3);">${m.email}</span>
        </div>
        <span class="tlr-count">${bookings.length} meeting${bookings.length !== 1 ? 's' : ''} today</span>
        <button class="btn-ghost" onclick="openBookModalFor('${m.id}')"><i class="fa-solid fa-plus"></i> Book</button>
        <button class="btn-ghost" onclick="removeTeamMember('${m.id}')" style="color:var(--red);"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  }).join('');
}

function openAddMemberModal() {
  const modalHtml = `
    <div class="modal-overlay" id="addMemberModal" style="display:flex" onclick="closeModalOutside(event,'addMemberModal')">
      <div class="modal">
        <div class="modal-header">
          <h3><i class="fa-solid fa-user-plus"></i> Add Team Member</h3>
          <button class="modal-close" onclick="closeModal('addMemberModal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <div class="modal-field">
            <label>Full Name *</label>
            <input type="text" id="newMemberName" class="modal-input" placeholder="Alex Morgan" required/>
          </div>
          <div class="modal-field">
            <label>Role *</label>
            <input type="text" id="newMemberRole" class="modal-input" placeholder="Account Executive" required/>
          </div>
          <div class="modal-field">
            <label>Email *</label>
            <input type="email" id="newMemberEmail" class="modal-input" placeholder="alex@company.com" required/>
          </div>
          <div class="modal-field">
            <label>Color</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <div class="color-option" style="background:#7c3aed" onclick="selectColor('#7c3aed')"></div>
              <div class="color-option" style="background:#0891b2" onclick="selectColor('#0891b2')"></div>
              <div class="color-option" style="background:#059669" onclick="selectColor('#059669')"></div>
              <div class="color-option" style="background:#d97706" onclick="selectColor('#d97706')"></div>
              <div class="color-option" style="background:#dc2626" onclick="selectColor('#dc2626')"></div>
              <div class="color-option" style="background:#8b5cf6" onclick="selectColor('#8b5cf6')"></div>
              <div class="color-option" style="background:#0ea5e9" onclick="selectColor('#0ea5e9')"></div>
            </div>
            <input type="hidden" id="newMemberColor" value="#7c3aed"/>
          </div>
          <button class="btn-primary btn-full" onclick="addTeamMember()">Add Team Member</button>
        </div>
      </div>
    </div>
    <style>
      .color-option { width:30px; height:30px; border-radius:6px; cursor:pointer; border:2px solid transparent; }
      .color-option:hover { border-color:var(--text); }
      .color-option.selected { border-color:var(--purple); box-shadow:0 0 0 2px var(--purple-light); }
    </style>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function selectColor(color) {
  document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
  document.getElementById('newMemberColor').value = color;
}

function addTeamMember() {
  const name = document.getElementById('newMemberName').value.trim();
  const role = document.getElementById('newMemberRole').value.trim();
  const email = document.getElementById('newMemberEmail').value.trim();
  const color = document.getElementById('newMemberColor').value;
  
  if (!name || !role || !email) {
    showToast('Please fill all required fields', 'error');
    return;
  }
  
  const team = getTeam();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  team.push({ id, name, role, email, avatar, color });
  localStorage.setItem('kestrel_team', JSON.stringify(team));
  
  closeModal('addMemberModal');
  renderTeamPanel();
  renderSidebarTeam();
  renderOverview();
  showToast(`✓ Added ${name} to team`);
}

function removeTeamMember(memberId) {
  if (!confirm('Remove this team member? Their bookings will be kept.')) return;
  
  const team = getTeam();
  const updatedTeam = team.filter(m => m.id !== memberId);
  localStorage.setItem('kestrel_team', JSON.stringify(updatedTeam));
  
  renderTeamPanel();
  renderSidebarTeam();
  renderOverview();
  showToast('Team member removed');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

function closeModalOutside(e, modalId) {
  if (e.target.id === modalId) closeModal(modalId);
}

// ===== BUFFER PANEL =====
function renderBufferPanel() {
  const el = document.getElementById('bufferGrid');
  if (!el) return;
  el.innerHTML = MEETING_TYPES.filter(mt => mt.id !== 'custom').map(mt => `
    <div class="bs-card">
      <div class="bs-icon"><i class="${mt.icon}"></i></div>
      <div class="bs-info">
        <span class="bs-name">${mt.label} (${mt.duration} min)</span>
        <span class="bs-desc">Buffer after call</span>
      </div>
      <div class="bs-control">
        <button class="bs-btn" onclick="changeBuffer('${mt.id}',-5)">−</button>
        <span class="bs-val" id="buf-${mt.id}">${bufferValues[mt.id]} min</span>
        <button class="bs-btn" onclick="changeBuffer('${mt.id}',5)">+</button>
      </div>
    </div>
  `).join('');
}

function changeBuffer(id, delta) {
  bufferValues[id] = Math.max(5, Math.min(60, (bufferValues[id] || 10) + delta));
  const el = document.getElementById(`buf-${id}`);
  if (el) el.textContent = `${bufferValues[id]} min`;
}

function saveBufferSettings() {
  localStorage.setItem('kestrel_buffers', JSON.stringify(bufferValues));
  showToast('Buffer settings saved — applies to all future bookings');
}

// ===== BOOK MODAL =====
function openBookModal() { 
  const team = getTeam();
  openBookModalFor(team[0].id); 
}

function openBookModalFor(memberId) {
  modalMemberIds = memberId ? [memberId] : [];
  modalTypeId = 'discovery';
  modalDate = null;
  modalSlot = null;
  const now = new Date();
  modalYear = now.getFullYear();
  modalMonth = now.getMonth();
  document.getElementById('bookModal').style.display = 'flex';
  document.getElementById('modalStepA').style.display = 'block';
  document.getElementById('modalStepB').style.display = 'none';
  document.getElementById('modalStepC').style.display = 'none';
  renderMemberPicker();
  renderTypePicker();
}

function closeBookModal() { document.getElementById('bookModal').style.display = 'none'; }
function closeModalOutside(e) { if (e.target.id === 'bookModal') closeBookModal(); }

function renderMemberPicker() {
  const team = getTeam();
  document.getElementById('memberPicker').innerHTML = team.map(m => `
    <div class="mp-item ${modalMemberIds.includes(m.id) ? 'active' : ''}" onclick="selectModalMember('${m.id}')">
      <div class="mp-avatar" style="background:${m.color}">${m.avatar}</div>
      <span>${m.name}</span>
      ${modalMemberIds.includes(m.id) ? '<i class="fa-solid fa-check" style="margin-left:auto; color:var(--purple-light);"></i>' : ''}
    </div>
  `).join('');
}

function selectModalMember(id) {
  const index = modalMemberIds.indexOf(id);
  if (index === -1) {
    modalMemberIds.push(id);
  } else {
    modalMemberIds.splice(index, 1);
  }
  renderMemberPicker();
}

function renderTypePicker() {
  document.getElementById('typePicker').innerHTML = MEETING_TYPES.map(mt => `
    <div class="tp-item ${mt.id === modalTypeId ? 'active' : ''}" onclick="selectModalType('${mt.id}')">
      <i class="${mt.icon}"></i>
      <span>${mt.label}</span>
      <span class="tp-dur">${mt.id === 'custom' ? 'Custom' : mt.duration + ' min'}</span>
    </div>
  `).join('');
}

function selectModalType(id) {
  modalTypeId = id;
  renderTypePicker();
  document.getElementById('customDurField').style.display = id === 'custom' ? 'block' : 'none';
}

function modalNextStep() {
  if (modalMemberIds.length === 0 || !modalTypeId) {
    showToast('Please select at least one team member', 'error');
    return;
  }
  document.getElementById('modalStepA').style.display = 'none';
  document.getElementById('modalStepB').style.display = 'block';
  const team = getTeam();
  const selectedMembers = team.filter(m => modalMemberIds.includes(m.id));
  const mt = MEETING_TYPES.find(t => t.id === modalTypeId);
  
  let membersHtml = '';
  selectedMembers.forEach(m => {
    membersHtml += `
      <div class="msi-row">
        <div class="msi-avatar" style="background:${m.color}">${m.avatar}</div>
        <span>${m.name}</span>
      </div>`;
  });
  
  document.getElementById('modalSelectedInfo').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:13px; color:var(--text2);">Booking for ${selectedMembers.length} team member(s):</div>
      ${membersHtml}
      <div style="font-size:13px; color:var(--purple-light); margin-top:4px;">
        <i class="fa-solid fa-calendar"></i> ${mt.label} (${mt.id === 'custom' ? 'Custom duration' : mt.duration + ' min'})
      </div>
    </div>`;
  renderModalCalendar();
}

function modalBackStep() {
  document.getElementById('modalStepB').style.display = 'none';
  document.getElementById('modalStepA').style.display = 'block';
}
function modalBackToB() {
  document.getElementById('modalStepC').style.display = 'none';
  document.getElementById('modalStepB').style.display = 'block';
}

function renderModalCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('modalMonthLabel').textContent = `${months[modalMonth]} ${modalYear}`;
  const grid = document.getElementById('modalCalDays');
  grid.innerHTML = '';
  const today = new Date();
  const firstDay = new Date(modalYear, modalMonth, 1).getDay();
  const daysInMonth = new Date(modalYear, modalMonth + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    const thisDate = new Date(modalYear, modalMonth, d);
    const isPast = thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isWeekend = thisDate.getDay() === 0 || thisDate.getDay() === 6;
    if (isPast || isWeekend) { el.classList.add('disabled'); }
    else {
      if (thisDate.toDateString() === today.toDateString()) el.classList.add('today');
      el.addEventListener('click', () => {
        document.querySelectorAll('#modalCalDays .cal-day').forEach(d => d.classList.remove('selected'));
        el.classList.add('selected');
        modalDate = thisDate;
        renderModalSlots();
      });
    }
    grid.appendChild(el);
  }
}

function modalPrevMonth() { modalMonth--; if (modalMonth < 0) { modalMonth = 11; modalYear--; } renderModalCalendar(); }
function modalNextMonth() { modalMonth++; if (modalMonth > 11) { modalMonth = 0; modalYear++; } renderModalCalendar(); }

function renderModalSlots() {
  const wrap = document.getElementById('modalSlotsWrap');
  wrap.style.display = 'block';
  const grid = document.getElementById('modalSlotsGrid');
  grid.innerHTML = '';
  const mt = MEETING_TYPES.find(t => t.id === modalTypeId);
  const dur = modalTypeId === 'custom'
    ? (parseInt(document.getElementById('modalCustomDur').value) || 20)
    : mt.duration;
  const buf = bufferValues[modalTypeId] || mt.buffer;
  const dateStr = dateToStr(modalDate);

  // Candidates: every 30 min + every buffer-end time for selected members
  const candidates = new Set();
  for (let t = 8*60; t < 18*60; t += 30) candidates.add(t);
  modalMemberIds.forEach(memberId => {
    getBookingsForMember(memberId, dateStr).forEach(b => {
      const bufEnd = b.startH*60 + b.startM + b.duration + b.buffer;
      if (bufEnd < 18*60) candidates.add(bufEnd);
    });
  });

  const available = [];
  Array.from(candidates).sort((a,b) => a-b).forEach(total => {
    const h = Math.floor(total/60), m = total%60;
    const allFree = modalMemberIds.every(id => getSlotStatus(id, dateStr, h, m, dur, buf) === 'free');
    if (allFree) available.push({h, m});
  });

  available.forEach(slot => {
    const btn = document.createElement('div');
    btn.className = 'slot-btn';
    btn.textContent = `${fmt(slot.h)}:${fmt(slot.m)}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modalSlotsGrid .slot-btn').forEach(b => b.classList.remove('slot-selected'));
      btn.classList.add('slot-selected');
      modalSlot = { h: slot.h, m: slot.m, dur, buf };
      setTimeout(() => showModalStepC(), 250);
    });
    grid.appendChild(btn);
  });

  if (available.length === 0) {
    grid.innerHTML = `<div style="padding:20px;color:var(--text2);text-align:center;">No available slots — try another date</div>`;
  }
}

function showModalStepC() {
  document.getElementById('modalStepB').style.display = 'none';
  document.getElementById('modalStepC').style.display = 'block';
  const team = getTeam();
  const selectedMembers = team.filter(m => modalMemberIds.includes(m.id));
  const mt = MEETING_TYPES.find(t => t.id === modalTypeId);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const endMins = modalSlot.h * 60 + modalSlot.m + modalSlot.dur;
  
  let membersList = '';
  selectedMembers.forEach(m => {
    membersList += `<div style="display:flex; align-items:center; gap:6px; margin:2px 0;">
      <div style="width:20px; height:20px; border-radius:50%; background:${m.color}; color:#fff; font-size:9px; display:flex; align-items:center; justify-content:center;">${m.avatar}</div>
      <span style="font-size:13px;">${m.name}</span>
    </div>`;
  });
  
  document.getElementById('modalSummaryBar').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <i class="fa-regular fa-calendar-check"></i>
        <span style="font-weight:600;">${selectedMembers.length} team member(s)</span>
      </div>
      <div style="font-size:13px; color:var(--text2);">
        ${mt.label} · ${days[modalDate.getDay()]} ${modalDate.getDate()} ${months[modalDate.getMonth()]} · ${fmt(modalSlot.h)}:${fmt(modalSlot.m)}–${fmt(Math.floor(endMins/60))}:${fmt(endMins%60)}
      </div>
      ${membersList}
    </div>
  `;
  
  // Update form fields
  const guestNameField = document.getElementById('modalGuestName');
  const guestEmailField = document.getElementById('modalGuestEmail');
  
  if (selectedMembers.length === 1) {
    guestNameField.placeholder = "Guest's name";
    guestEmailField.placeholder = "Guest's email";
  } else {
    guestNameField.placeholder = "Meeting title/guest name";
    guestEmailField.placeholder = "Primary contact email";
  }
}

function confirmManagerBooking() {
  const guestName = document.getElementById('modalGuestName').value.trim();
  const guestEmail = document.getElementById('modalGuestEmail').value.trim();
  const notes = document.getElementById('modalNotes').value.trim();
  
  if (!guestName) { 
    showToast('Please enter a meeting title or guest name', 'error'); 
    return; 
  }
  
  const team = getTeam();
  const selectedMembers = team.filter(m => modalMemberIds.includes(m.id));
  const mt = MEETING_TYPES.find(t => t.id === modalTypeId);
  
  // Create booking for each selected member
  selectedMembers.forEach(member => {
    saveBooking({
      memberId: member.id,
      memberName: member.name,
      date: dateToStr(modalDate),
      startH: modalSlot.h,
      startM: modalSlot.m,
      duration: modalSlot.dur,
      buffer: modalSlot.buf,
      type: mt.label,
      guestName,
      guestEmail: guestEmail || member.email,
      notes,
      bookedBy: 'manager',
      meetingWith: selectedMembers.length > 1 ? 'Multiple team members' : undefined
    });
  });
  
  closeBookModal();
  renderOverview();
  renderMySchedule();
  renderTeamPanel();
  
  if (selectedMembers.length === 1) {
    showToast(`✓ Booked ${mt.label} for ${selectedMembers[0].name} with ${guestName}`);
  } else {
    showToast(`✓ Booked ${mt.label} for ${selectedMembers.length} team members with ${guestName}`);
  }
}

// ===== UTILS =====
function addTooltip(el, text) {
  const tip = document.getElementById('slotTooltip');
  el.addEventListener('mouseenter', e => { tip.textContent = text; tip.style.display = 'block'; positionTooltip(e); });
  el.addEventListener('mousemove', positionTooltip);
  el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}
function positionTooltip(e) {
  const tip = document.getElementById('slotTooltip');
  tip.style.left = (e.clientX + 14) + 'px';
  tip.style.top = (e.clientY - 44) + 'px';
}

function resetData() {
  if (confirm('Clear all bookings? This cannot be undone.')) {
    localStorage.removeItem('kestrel_bookings');
    renderOverview(); renderMySchedule(); renderTeamPanel();
    showToast('All bookings cleared');
  }
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
