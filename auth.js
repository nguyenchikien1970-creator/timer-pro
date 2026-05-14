/* =============================================
   TIMER PRO — Authentication Logic
   ============================================= */

(() => {
    'use strict';

    const AUTH_KEY = 'timerPro_auth';
    const USERS_KEY = 'timerPro_users';

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================
    function getUsers() {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function setAuth(user) {
        const session = {
            email: user.email,
            name: user.name || user.email.split('@')[0],
            loggedInAt: new Date().toISOString()
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }

    function getAuth() {
        const data = localStorage.getItem(AUTH_KEY);
        return data ? JSON.parse(data) : null;
    }

    function clearAuth() {
        localStorage.removeItem(AUTH_KEY);
    }

    // Simple hash for password (not for production — demo only)
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'h_' + Math.abs(hash).toString(36);
    }

    // =============================================
    // AUTH CHECK — Redirect if needed
    // =============================================
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isLoginPage = currentPage === 'login.html';
    const auth = getAuth();

    if (isLoginPage && auth) {
        // Already logged in → go to app
        window.location.href = 'index.html';
        return;
    }

    if (!isLoginPage && !auth) {
        // Not logged in → go to login
        window.location.href = 'login.html';
        return;
    }

    // =============================================
    // LOGIN PAGE LOGIC
    // =============================================
    if (isLoginPage) {
        const form = document.getElementById('login-form');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const errorBox = document.getElementById('login-error');
        const loginBtn = document.getElementById('login-btn');
        const toggleBtn = document.getElementById('toggle-password');
        const signupLink = document.getElementById('signup-link');
        const forgotLink = document.getElementById('forgot-link');

        let isSignupMode = false;

        // Toggle password visibility
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            document.getElementById('eye-open').style.display = isPassword ? 'none' : 'block';
            document.getElementById('eye-closed').style.display = isPassword ? 'block' : 'none';
        });

        // Show error
        function showError(msg) {
            errorBox.textContent = msg;
            errorBox.style.display = 'block';
        }

        function hideError() {
            errorBox.style.display = 'none';
        }

        // Switch between Login/Signup
        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            isSignupMode = !isSignupMode;
            hideError();

            if (isSignupMode) {
                loginBtn.querySelector('.btn-text').textContent = 'Create Account';
                signupLink.textContent = 'Sign in instead';
                document.querySelector('.login-footer').firstChild.textContent = 'Already have an account? ';
                document.querySelector('.login-logo p').textContent = 'Create your free account';
            } else {
                loginBtn.querySelector('.btn-text').textContent = 'Sign In';
                signupLink.textContent = 'Create one';
                document.querySelector('.login-footer').firstChild.textContent = "Don't have an account? ";
                document.querySelector('.login-logo p').textContent = 'Sign in to your productivity dashboard';
            }
        });

        // Forgot password
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) {
                showError('Please enter your email first, then click "Forgot password?"');
                return;
            }
            const users = getUsers();
            const user = users.find(u => u.email === email.toLowerCase());
            if (!user) {
                showError('No account found with this email.');
                return;
            }
            // Reset password to "123456"
            user.password = hashPassword('123456');
            saveUsers(users);
            hideError();
            errorBox.style.display = 'block';
            errorBox.style.background = 'rgba(52, 211, 153, 0.1)';
            errorBox.style.borderColor = 'rgba(52, 211, 153, 0.2)';
            errorBox.style.color = '#34d399';
            errorBox.textContent = 'Password has been reset to "123456". Please login and change it.';
        });

        // Form submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            hideError();

            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            if (!email || !password) {
                showError('Please enter both email and password.');
                return;
            }

            if (password.length < 6) {
                showError('Password must be at least 6 characters.');
                return;
            }

            // Loading state
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;

            setTimeout(() => {
                const users = getUsers();
                const hashedPw = hashPassword(password);

                if (isSignupMode) {
                    // SIGNUP
                    const exists = users.find(u => u.email === email);
                    if (exists) {
                        loginBtn.classList.remove('loading');
                        loginBtn.disabled = false;
                        showError('An account with this email already exists. Try signing in.');
                        return;
                    }

                    const newUser = {
                        email: email,
                        password: hashedPw,
                        name: email.split('@')[0],
                        createdAt: new Date().toISOString()
                    };
                    users.push(newUser);
                    saveUsers(users);
                    setAuth(newUser);
                    window.location.href = 'index.html';
                } else {
                    // LOGIN
                    const user = users.find(u => u.email === email && u.password === hashedPw);
                    if (!user) {
                        loginBtn.classList.remove('loading');
                        loginBtn.disabled = false;
                        showError('Invalid email or password. Please try again.');
                        return;
                    }

                    setAuth(user);
                    window.location.href = 'index.html';
                }
            }, 800);
        });

        // Auto-focus email field
        emailInput.focus();
    }

    // =============================================
    // APP PAGE — Add user info & logout
    // =============================================
    if (!isLoginPage && auth) {
        // Wait for DOM to be ready
        document.addEventListener('DOMContentLoaded', () => {
            // Add logout button to header
            const header = document.querySelector('.app-header');
            if (header) {
                const userSection = document.createElement('div');
                userSection.className = 'header-user';
                userSection.innerHTML = `
                    <span class="user-greeting">${auth.name}</span>
                    <button class="logout-btn" id="logout-btn" title="Sign out">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                    </button>
                `;
                header.appendChild(userSection);

                document.getElementById('logout-btn').addEventListener('click', () => {
                    clearAuth();
                    window.location.href = 'login.html';
                });
            }
        });
    }

})();
