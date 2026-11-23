// logout.js - Simple logout functionality

function logout() {
  // Clear user session
  localStorage.removeItem('kestrel_user');
  // Redirect to login page
  window.location.href = 'login.html';
  return false;
}