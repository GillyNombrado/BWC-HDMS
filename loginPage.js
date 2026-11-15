/* ==========================================================================
   BWC-HDMS Portal - Login Page Logic (loginPage.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const privacyCheck = document.getElementById('privacyCheck');
    const loginBtn = document.getElementById('loginBtn');

    if (privacyCheck && loginBtn) {
        privacyCheck.addEventListener('change', () => {
            loginBtn.disabled = !privacyCheck.checked;
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim() || 'Midwife Maria';
            const password = document.getElementById('loginPassword').value.trim() || '123456';
            const station = document.getElementById('loginStation').value || 'BHS Purok 3 Station';

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';

            try {
                const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, station })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    sessionStorage.setItem('bwc_user', result.user.username);
                    sessionStorage.setItem('bwc_role', result.user.role);
                    sessionStorage.setItem('bwc_station', result.user.station);

                    showNotification(`Welcome back, ${result.user.full_name || result.user.username}. Initializing secure station...`, 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboardPage.html';
                    }, 800);
                    return;
                } else if (response.status === 401) {
                    showNotification(result.error || 'Authentication failed: Invalid credentials.', 'danger');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In to Terminal Station';
                    return;
                }
            } catch (err) {
                // Offline fallback mode for local station pre-check
                console.warn('[Offline Auth] Backend server unreachable; defaulting to offline terminal session.');
            }

            // Local fallback session
            sessionStorage.setItem('bwc_user', username);
            sessionStorage.setItem('bwc_station', station);
            showNotification(`Welcome back, ${username}. Initializing local offline station...`, 'success');

            setTimeout(() => {
                window.location.href = 'dashboardPage.html';
            }, 800);
        });
    }
});
