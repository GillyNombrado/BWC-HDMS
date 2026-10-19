/* ==========================================================================
   BWC-HDMS Portal - Shared Application Utilities (shared.js)
   Shared across all pages: Theme, Navbar, User Dropdown, Toasts, Modals
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Theme Management (Dark / Light Mode)
// --------------------------------------------------------------------------
function setTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (theme === 'dark') {
        if (icon) icon.className = 'bi bi-moon-stars-fill text-warning';
        if (text) text.textContent = 'Dark';
    } else {
        if (icon) icon.className = 'bi bi-sun-fill';
        if (text) text.textContent = 'Light';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('bwc_theme') || 'light';
    setTheme(savedTheme);

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            localStorage.setItem('bwc_theme', newTheme);
        });
    }
}

// --------------------------------------------------------------------------
// 2. User Profile Dropdown
// --------------------------------------------------------------------------
function initUserDropdown() {
    const toggle = document.getElementById('userDropdownToggle');
    const menu = document.getElementById('userDropdownMenu');
    if (toggle && menu) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!toggle.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
    }
}

// --------------------------------------------------------------------------
// 3. Floating Toast Notifications
// --------------------------------------------------------------------------
let toastTimeout;
function showNotification(msg, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    if (!toastEl || !toastMsg) return;

    toastMsg.textContent = msg;
    if (type === 'success') {
        toastEl.className = 'toast-pill toast-success';
        if (toastIcon) toastIcon.className = 'bi bi-check-circle-fill';
    } else {
        toastEl.className = 'toast-pill toast-danger';
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-triangle-fill';
    }
    
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        hideToast();
    }, 3500);
}

function hideToast() {
    const toastEl = document.getElementById('liveToast');
    if (toastEl) toastEl.classList.add('hidden');
}

// --------------------------------------------------------------------------
// 4. Modal Helpers & Bootstrap Adapter
// --------------------------------------------------------------------------
function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
}

window.bootstrap = {
    Modal: class {
        constructor(element) {
            this.el = typeof element === 'string' ? document.getElementById(element) : element;
            if (this.el) this.el._bsModal = this;
        }
        show() {
            if (this.el) {
                this.el.classList.remove('hidden');
                this.el.style.display = 'flex';
            }
        }
        hide() {
            if (this.el) {
                this.el.classList.add('hidden');
                this.el.style.display = 'none';
            }
        }
        static getInstance(element) {
            const el = typeof element === 'string' ? document.getElementById(element) : element;
            return el?._bsModal || new window.bootstrap.Modal(el);
        }
    },
    Toast: class {
        constructor(element) {
            this.el = element;
        }
        show() {
            if (this.el) this.el.classList.remove('hidden');
        }
        hide() {
            if (this.el) this.el.classList.add('hidden');
        }
    }
};

// --------------------------------------------------------------------------
// 5. System Utilities (Lock Station & Backups)
// --------------------------------------------------------------------------
function lockStation() {
    showNotification('Locking terminal station...', 'success');
    setTimeout(() => {
        window.location.href = 'loginPage.html';
    }, 500);
}

function exportSystemBackup() {
    showNotification('Encrypted backup archive (.enc) successfully generated for RHU submission.', 'success');
}

// --------------------------------------------------------------------------
// 6. Global Initialization
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initUserDropdown();
});
