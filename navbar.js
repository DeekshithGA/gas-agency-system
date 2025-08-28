// navbar.js
import { auth, logSystemEvent } from '../firebase.js';

// DOM Elements (example selectors)
const navbarToggle = document.getElementById('navbar-toggle');
const navbarMenu = document.getElementById('navbar-menu');
const navbarLinksContainer = document.getElementById('navbar-links');
const userProfileMenu = document.getElementById('user-profile-menu');
const notificationBadge = document.getElementById('notification-badge');
const searchInput = document.getElementById('navbar-search-input');
const logoutBtn = document.getElementById('logout-btn');

let currentUser = null;
let unreadNotifications = 0;

// Menu items for different roles
const menuItems = {
  guest: [
    { name: 'Home', href: 'index.html' },
    { name: 'Login', href: 'login.html' },
    { name: 'Register', href: 'register.html' }
  ],
  user: [
    { name: 'Home', href: 'index.html' },
    { name: 'Book Cylinder', href: 'user.html' },
    { name: 'My Bookings', href: 'history.html' },
    { name: 'Payments', href: 'payment.html' }
  ],
  admin: [
    { name: 'Admin Dashboard', href: 'admin.html' },
    { name: 'Manage Bookings', href: 'admin-bookings.html' },
    { name: 'Manage Notices', href: 'admin-notices.html' },
    { name: 'User Management', href: 'admin-users.html' }
  ]
};

// Initialize Navbar
export function initializeNavbar() {
  setupToggleMenu();
  setupLogout();
  auth.onAuthStateChanged(user => {
    currentUser = user;
    renderMenu();
    updateUserProfile();
    // Example: Load unread notifications count (stub)
    updateNotificationCount(unreadNotifications);
  });
  setupSearch();
}

// Responsive toggle menu for mobile
function setupToggleMenu() {
  if (!navbarToggle || !navbarMenu) return;
  navbarToggle.addEventListener('click', () => {
    navbarMenu.classList.toggle('open');
    navbarToggle.setAttribute('aria-expanded', navbarMenu.classList.contains('open'));
  });
}

// Render menu items based on user role
function renderMenu() {
  if (!navbarLinksContainer) return;
  navbarLinksContainer.innerHTML = "";

  let role = 'guest';
  if (currentUser) {
    currentUser.getIdTokenResult().then(idTokenResult => {
      role = idTokenResult.claims.admin ? 'admin' : 'user';
      buildMenuForRole(role);
    }).catch(() => {
      buildMenuForRole('user');
    });
  } else {
    buildMenuForRole(role);
  }
}

// Helper: Build menu items and append to container
function buildMenuForRole(role) {
  const items = menuItems[role] || menuItems['guest'];
  items.forEach(item => {
    const li = document.createElement('li');
    li.classList.add('nav-item');

    const a = document.createElement('a');
    a.classList.add('nav-link');
    a.href = item.href;
    a.textContent = item.name;
    a.setAttribute('tabindex', '0');
    li.appendChild(a);

    navbarLinksContainer.appendChild(li);
  });
}

// Update user profile display (avatar, name) and dropdown menu
function updateUserProfile() {
  if (!userProfileMenu) return;
  if (currentUser) {
    const displayName = currentUser.displayName || currentUser.email || "User";
    userProfileMenu.innerHTML = `
      <button aria-haspopup="true" aria-expanded="false" id="profile-button">${displayName} ▼</button>
      <ul id="profile-dropdown" class="dropdown-menu" aria-labelledby="profile-button" hidden>
        <li><a href="profile.html" tabindex="0">Profile</a></li>
        <li><a href="#" id="logout-btn-inside" tabindex="0">Logout</a></li>
      </ul>
    `;
    setupProfileDropdown();
  } else {
    userProfileMenu.innerHTML = '';
  }
}

// Profile dropdown toggle and accessibility support
function setupProfileDropdown() {
  const profileButton = document.getElementById('profile-button');
  const dropdown = document.getElementById('profile-dropdown');

  if (!profileButton || !dropdown) return;

  profileButton.addEventListener('click', () => {
    const isExpanded = profileButton.getAttribute('aria-expanded') === 'true';
    profileButton.setAttribute('aria-expanded', !isExpanded);
    dropdown.hidden = isExpanded;
  });

  // Close dropdown on blur or escape key
  dropdown.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      profileButton.setAttribute('aria-expanded', 'false');
      dropdown.hidden = true;
      profileButton.focus();
    }
  });
}

// Setup logout buttons and handler
function setupLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async e => {
      e.preventDefault();
      await doLogout();
    });
  }
  document.body.addEventListener('click', async e => {
    if (e.target && e.target.id === 'logout-btn-inside') {
      e.preventDefault();
      await doLogout();
    }
  });
}

// Perform logout
async function doLogout() {
  try {
    await auth.signOut();
    logSystemEvent('user_logged_out', { uid: currentUser?.uid });
    window.location.href = 'index.html';
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
}

// Notification count updater (stub, extend with real notifications integration)
function updateNotificationCount(count) {
  if (!notificationBadge) return;
  notificationBadge.textContent = count > 0 ? count : '';
  notificationBadge.style.display = count > 0 ? 'inline-block' : 'none';
}

// Search input handling (optional advanced feature)
function setupSearch() {
  if (!searchInput) return;
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        // Implement search action, e.g., navigate to search results page
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      }
    }
  });
}
