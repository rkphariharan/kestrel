// ===== KESTREL SHARED DATA LAYER =====
// Single source of truth for team, bookings, buffer logic
// Used by both dashboard.js and book.js

// Dynamic data loaded from localStorage
function getTeam() {
  try {
    const stored = localStorage.getItem('kestrel_team');
    if (stored) return JSON.parse(stored);
  } catch {}
  // Default team
  return [
    { id: 'alex',   name: 'Alex Morgan',  role: 'Account Executive',    avatar: 'AM', color: '#7c3aed', email: 'alex@company.com' },
    { id: 'priya',  name: 'Priya Nair',   role: 'Customer Success',     avatar: 'PN', color: '#0891b2', email: 'priya@company.com' },
    { id: 'marcus', name: 'Marcus Trent', role: 'Solutions Engineer',   avatar: 'MT', color: '#059669', email: 'marcus@company.com' },
    { id: 'lucia',  name: 'Lucia Ferreira', role: 'Account Manager',   avatar: 'LF', color: '#d97706', email: 'lucia@company.com' },
    { id: 'tom',    name: 'Tom Ashby',    role: 'Sales Development',    avatar: 'TA', color: '#dc2626', email: 'tom@company.com' },
  ];
}

const MEETING_TYPES = [
  { id: 'quick',     label: 'Quick Sync',     duration: 15, icon: 'fa-regular fa-clock',     buffer: 10 },
  { id: 'discovery', label: 'Discovery Call', duration: 30, icon: 'fa-solid fa-comments',    buffer: 10 },
  { id: 'demo',      label: 'Product Demo',   duration: 45, icon: 'fa-solid fa-laptop',      buffer: 10 },
  { id: 'deepdive',  label: 'Deep Dive',      duration: 60, icon: 'fa-solid fa-handshake',   buffer: 15 },
  { id: 'custom',    label: 'Custom',         duration: 0,  icon: 'fa-solid fa-sliders',     buffer: 10 },
];

function getManager() {
  try {
    const user = JSON.parse(localStorage.getItem('kestrel_user') || '{}');
    if (user.name) return { name: user.name, role: 'Team Manager', avatar: getInitials(user.name) };
  } catch {}
  return { name: 'Sarah Chen', role: 'Team Manager', avatar: 'SC' };
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ===== STORAGE =====
function getBookings() {
  try { 
    const bookings = JSON.parse(localStorage.getItem('kestrel_bookings') || '[]');
    // Add demo bookings if none exist
    if (bookings.length === 0) {
      const demoBookings = createDemoBookings();
      localStorage.setItem('kestrel_bookings', JSON.stringify(demoBookings));
      return demoBookings;
    }
    return bookings;
  }
  catch { return []; }
}

function createDemoBookings() {
  const today = new Date();
  const ds = `${today.getFullYear()}-${fmt(today.getMonth()+1)}-${fmt(today.getDate())}`;
  const team = getTeam();
  if (team.length === 0) return [];

  // Each member gets 5 calls, all 30 min + 10 min buffer = ends at :30, next free at :40
  // Scattered across the day, no back-to-back
  const schedules = [
    [ [9,0],[11,0],[13,0],[15,0],[16,30] ],
    [ [9,30],[11,30],[13,30],[15,30],[17,0] ],
    [ [10,0],[12,0],[14,0],[16,0],[17,30] ],
    [ [9,0],[11,30],[13,0],[15,30],[17,0] ],
    [ [10,30],[12,30],[14,30],[16,30],[17,30] ],
  ];
  const companies = ['Acme Corp','TechStart Inc','Global Solutions','StartupXYZ','Innovate Co'];
  const types = ['Discovery Call','Discovery Call','Discovery Call','Discovery Call','Discovery Call'];

  const bookings = [];
  team.forEach((member, mi) => {
    const slots = schedules[mi % schedules.length];
    slots.forEach(([h, m], i) => {
      bookings.push({
        id: `demo-${member.id}-${i}`,
        memberId: member.id,
        memberName: member.name,
        date: ds,
        startH: h,
        startM: m,
        duration: 30,
        buffer: 10,
        type: types[i],
        guestName: companies[i],
        guestEmail: `contact@${companies[i].toLowerCase().replace(/\s+/g,'')}.com`,
        notes: '',
        bookedBy: 'manager'
      });
    });
  });
  return bookings;
}

function saveBooking(booking) {
  const bookings = getBookings();
  booking.id = Date.now() + Math.random().toString(36).slice(2);
  bookings.push(booking);
  localStorage.setItem('kestrel_bookings', JSON.stringify(bookings));
  return booking;
}

function getBookingsForMember(memberId, dateStr) {
  return getBookings().filter(b => b.memberId === memberId && b.date === dateStr);
}

function getTheme() {
  return localStorage.getItem('kestrel_theme') || 'dark';
}
function setTheme(theme) {
  localStorage.setItem('kestrel_theme', theme);
  applyTheme(theme);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = theme === 'dark'
    ? '<i class="fa-solid fa-moon"></i>'
    : '<i class="fa-solid fa-sun"></i>';
}

// ===== BUFFER LOGIC =====
// Returns 'free' | 'buffer' | 'booked'
function getSlotStatus(memberId, dateStr, slotH, slotM, durationMins, bufferMins) {
  const bookings = getBookingsForMember(memberId, dateStr);
  const slotStart = slotH * 60 + slotM;
  const slotEnd = slotStart + durationMins;

  for (const b of bookings) {
    const bStart = b.startH * 60 + b.startM;
    const bEnd = bStart + b.duration;
    const bEndWithBuffer = bEnd + b.buffer;

    // Slot overlaps with an existing booking
    if (slotStart < bEnd && slotEnd > bStart) return 'booked';
    
    // Check if this is the next available slot after buffer
    if (slotStart === bEndWithBuffer) {
      // This is the first available slot after buffer - make it selectable
      return 'free';
    }
    
    // Slot is in buffer zone
    if (slotStart >= bEnd && slotStart < bEndWithBuffer) return 'buffer';
    
    // New booking's buffer would overlap with next booking
    if (slotStart < bStart && slotEnd + bufferMins > bStart) return 'booked';
  }
  return 'free';
}

function getBufferTooltip(memberId, dateStr, slotH, slotM) {
  const bookings = getBookingsForMember(memberId, dateStr);
  const slotStart = slotH * 60 + slotM;
  for (const b of bookings) {
    const bEnd = b.startH * 60 + b.startM + b.duration;
    const bEndWithBuffer = bEnd + b.buffer;
    if (slotStart >= bEnd && slotStart < bEndWithBuffer) {
      const nextAvail = bEndWithBuffer;
      return `🛡 ${b.memberName} is finishing "${b.type}" at ${fmt(Math.floor(bEnd/60))}:${fmt(bEnd%60)}. Buffer protected — next available: ${fmt(Math.floor(nextAvail/60))}:${fmt(nextAvail%60)}`;
    }
  }
  return 'Buffer time protected.';
}

function fmt(n) { return String(n).padStart(2, '0'); }

function getMemberById(id) { 
  const team = getTeam();
  return team.find(m => m.id === id); 
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${fmt(d.getMonth()+1)}-${fmt(d.getDate())}`;
}

function dateToStr(date) {
  return `${date.getFullYear()}-${fmt(date.getMonth()+1)}-${fmt(date.getDate())}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
