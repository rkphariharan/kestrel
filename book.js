// book.js — Customer-facing booking page

let selectedMemberId = null;
let selectedTypeId = 'discovery';
let selectedDuration = 30;
let selectedBuffer = 10;
let selectedDate = null;
let selectedSlot = null;
let currentYear, currentMonth;

window.addEventListener('DOMContentLoaded', () => {
  applyTheme(getTheme());
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  
  // Load team and select first member
  const team = getTeam();
  if (team.length > 0) {
    selectedMemberId = team[0].id;
  }
  
  renderMemberList();
  renderMeetingTypeList();
  renderCalendar();
  document.getElementById('userTzDisplay').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
});

// ===== MEMBER SELECT =====
function renderMemberList() {
  const team = getTeam();
  document.getElementById('memberSelectList').innerHTML = team.map(m => `
    <div class="member-select-item ${m.id === selectedMemberId ? 'active' : ''}" onclick="selectMember('${m.id}')">
      <div class="msi-av" style="background:${m.color}">${m.avatar}</div>
      <div class="msi-info">
        <span class="msi-name">${m.name}</span>
        <span class="msi-role">${m.role}</span>
      </div>
    </div>
  `).join('');
}

function selectMember(id) {
  selectedMemberId = id;
  renderMemberList();
  if (selectedDate) renderSlots();
}

// ===== MEETING TYPE =====
function renderMeetingTypeList() {
  document.getElementById('meetingTypeList').innerHTML = MEETING_TYPES.map(mt => `
    <div class="meeting-type ${mt.id === selectedTypeId ? 'active' : ''}" onclick="selectType('${mt.id}')">
      <div class="mt-icon"><i class="${mt.icon}"></i></div>
      <div class="mt-info">
        <span class="mt-name">${mt.label}</span>
        <span class="mt-dur">${mt.id === 'custom' ? 'You choose' : mt.duration + ' min'}</span>
      </div>
    </div>
  `).join('');
}

function selectType(id) {
  selectedTypeId = id;
  const mt = MEETING_TYPES.find(t => t.id === id);
  selectedDuration = mt.duration;
  selectedBuffer = mt.buffer;
  const customWrap = document.getElementById('customDurWrap');
  customWrap.style.display = id === 'custom' ? 'block' : 'none';
  if (id === 'custom') {
    document.getElementById('customDurInput').oninput = e => {
      selectedDuration = parseInt(e.target.value) || 20;
    };
    selectedDuration = parseInt(document.getElementById('customDurInput').value) || 20;
  }
  renderMeetingTypeList();
  if (selectedDate) renderSlots();
}

// ===== CALENDAR =====
function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${months[currentMonth]} ${currentYear}`;
  const grid = document.getElementById('calDays');
  grid.innerHTML = '';
  const today = new Date();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    const thisDate = new Date(currentYear, currentMonth, d);
    const isPast = thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isWeekend = thisDate.getDay() === 0 || thisDate.getDay() === 6;
    if (isPast || isWeekend) { el.classList.add('disabled'); }
    else {
      if (thisDate.toDateString() === today.toDateString()) el.classList.add('today');
      el.addEventListener('click', () => pickDate(thisDate, el));
    }
    grid.appendChild(el);
  }
}

function prevMonth() { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar(); }
function nextMonth() { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); }

function pickDate(date, el) {
  document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  selectedDate = date;
  showStep2(date);
}

// ===== SLOTS =====
function showStep2(date) {
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('selectedDateLabel').textContent = `· ${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  renderSlots();
}

function renderSlots() {
  const grid = document.getElementById('slotsGrid');
  grid.innerHTML = '';
  const dateStr = dateToStr(selectedDate);
  const bookings = getBookingsForMember(selectedMemberId, dateStr);

  // Build candidate times: every 30 min from 8:00 to 18:00
  // PLUS every buffer-end time so e.g. 9:40 always appears
  const candidates = new Set();
  for (let total = 8*60; total < 18*60; total += 30) candidates.add(total);
  bookings.forEach(b => {
    const bufEnd = b.startH*60 + b.startM + b.duration + b.buffer;
    if (bufEnd < 18*60) candidates.add(bufEnd);
  });

  Array.from(candidates).sort((a,b) => a-b).forEach(total => {
    const h = Math.floor(total / 60);
    const m = total % 60;
    const status = getSlotStatus(selectedMemberId, dateStr, h, m, selectedDuration, selectedBuffer);
    if (status !== 'free') return;

    const btn = document.createElement('div');
    btn.className = 'slot-btn';
    btn.textContent = `${fmt(h)}:${fmt(m)}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-selected'));
      btn.classList.add('slot-selected');
      selectedSlot = { h, m };
      setTimeout(() => showStep3(), 250);
    });
    grid.appendChild(btn);
  });

  if (grid.children.length === 0) {
    grid.innerHTML = `<div style="padding:20px;color:var(--text2);text-align:center;">No available slots — try another date</div>`;
  }
}

// ===== STEP 3 =====
function showStep3() {
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step3').style.display = 'block';
  const m = getMemberById(selectedMemberId);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const endMins = selectedSlot.h * 60 + selectedSlot.m + selectedDuration;
  document.getElementById('summaryText').textContent =
    `${m.name} · ${days[selectedDate.getDay()]}, ${selectedDate.getDate()} ${months[selectedDate.getMonth()]} · ${fmt(selectedSlot.h)}:${fmt(selectedSlot.m)}–${fmt(Math.floor(endMins/60))}:${fmt(endMins%60)} · ${selectedDuration} min`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('inviteeTzTime').textContent = `${fmt(selectedSlot.h)}:${fmt(selectedSlot.m)} (${tz})`;
  document.getElementById('hostTzTime').textContent = `${fmt(selectedSlot.h)}:${fmt(selectedSlot.m)} (Europe/London)`;
}

// ===== CONFIRM =====
function confirmBooking(e) {
  e.preventDefault();
  const fname = document.getElementById('fname').value.trim();
  const lname = document.getElementById('lname').value.trim();
  const email = document.getElementById('email').value.trim();
  const m = getMemberById(selectedMemberId);
  const mt = MEETING_TYPES.find(t => t.id === selectedTypeId);
  saveBooking({
    memberId: selectedMemberId,
    memberName: m.name,
    date: dateToStr(selectedDate),
    startH: selectedSlot.h,
    startM: selectedSlot.m,
    duration: selectedDuration,
    buffer: selectedBuffer,
    type: mt.label,
    guestName: `${fname} ${lname}`,
    guestEmail: email,
    notes: document.getElementById('notes').value,
    bookedBy: 'customer'
  });
  showStep4(email, m);
}

function showStep4(email, member) {
  document.getElementById('step3').style.display = 'none';
  document.getElementById('step4').style.display = 'block';
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const endMins = selectedSlot.h * 60 + selectedSlot.m + selectedDuration;
  document.getElementById('confirmedEmail').textContent = email;
  document.getElementById('confirmedHost').textContent = `${member.name} · ${member.role}`;
  document.getElementById('confirmedDate').textContent = `${days[selectedDate.getDay()]}, ${selectedDate.getDate()} ${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  document.getElementById('confirmedTime').textContent = `${fmt(selectedSlot.h)}:${fmt(selectedSlot.m)} – ${fmt(Math.floor(endMins/60))}:${fmt(endMins%60)} (${selectedDuration} min)`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('confirmedTz').textContent = `Your timezone: ${tz}`;
}

// ===== BACK =====
function goBack(fromStep) {
  if (fromStep === 2) { document.getElementById('step2').style.display = 'none'; document.getElementById('step1').style.display = 'block'; }
  if (fromStep === 3) { document.getElementById('step3').style.display = 'none'; document.getElementById('step2').style.display = 'block'; }
}

// ===== TOOLTIP =====
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
