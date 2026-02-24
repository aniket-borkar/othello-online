/**
 * auth-view.js
 * Login/Register form view with SSO, forgot-password, and reset-password.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var container = null;
  var currentMode = 'auth'; // 'auth', 'forgot', 'reset'
  var ssoConfig = { google: false, discord: false };

  // SVG icons for SSO buttons
  var googleSvg = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';

  var discordSvg = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#fff" d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.27 18.27 0 0 0-5.5 0 12.64 12.64 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C1.16 8.17.35 11.82.77 15.42a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.29a.08.08 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.07 0a.08.08 0 0 1 .08 0c.12.1.25.2.37.3a.08.08 0 0 1 0 .12c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.11c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .08.03 19.83 19.83 0 0 0 6-3.03.08.08 0 0 0 .04-.05c.5-4.18-.84-7.81-3.56-11.02a.06.06 0 0 0-.04-.03zM8.02 13.1c-.95 0-1.74-.88-1.74-1.95s.77-1.95 1.74-1.95c.98 0 1.75.88 1.74 1.95 0 1.07-.77 1.95-1.74 1.95zm6.44 0c-.96 0-1.74-.88-1.74-1.95s.77-1.95 1.74-1.95c.97 0 1.74.88 1.74 1.95 0 1.07-.77 1.95-1.74 1.95z"/></svg>';

  function fetchSsoConfig() {
    fetch('/api/auth-config')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        ssoConfig = data;
        updateSsoVisibility();
      })
      .catch(function () { /* ignore — SSO buttons stay hidden */ });
  }

  function updateSsoVisibility() {
    if (!container) return;
    var ssoSection = container.querySelector('.sso-section');
    if (!ssoSection) return;

    var googleBtn = ssoSection.querySelector('.btn-google');
    var discordBtn = ssoSection.querySelector('.btn-discord');

    if (googleBtn) googleBtn.style.display = ssoConfig.google ? 'flex' : 'none';
    if (discordBtn) discordBtn.style.display = ssoConfig.discord ? 'flex' : 'none';

    // Show entire SSO section only if at least one provider is configured
    var anyConfigured = ssoConfig.google || ssoConfig.discord;
    ssoSection.style.display = anyConfigured ? 'block' : 'none';

    // Also show/hide the divider
    var divider = container.querySelector('.auth-divider');
    if (divider) divider.style.display = anyConfigured ? 'flex' : 'none';
  }

  function render(parentContainer, options) {
    container = parentContainer;
    currentMode = (options && options.mode) || 'auth';

    if (currentMode === 'reset') {
      renderResetPassword(options.token);
      return;
    }

    if (currentMode === 'forgot') {
      renderForgotPassword();
      return;
    }

    renderAuthForm();
    fetchSsoConfig();
  }

  function renderAuthForm() {
    var html = '' +
      '<div class="auth-container">' +
        '<h1 class="logo">OTHELLO</h1>' +
        '<div class="auth-card">' +
          '<p class="auth-subtitle">Play Othello online with friends</p>' +

          // SSO buttons (hidden by default, shown if configured)
          '<div class="sso-section" style="display:none;">' +
            '<div class="sso-buttons">' +
              '<a href="/auth/google" class="btn-sso btn-google" style="display:none;">' +
                googleSvg + ' Continue with Google' +
              '</a>' +
              '<a href="/auth/discord" class="btn-sso btn-discord" style="display:none;">' +
                discordSvg + ' Continue with Discord' +
              '</a>' +
            '</div>' +
          '</div>' +
          '<div class="auth-divider" style="display:none;"><span>or</span></div>' +

          '<div class="auth-tabs">' +
            '<button class="auth-tab active" data-tab="login">Login</button>' +
            '<button class="auth-tab" data-tab="register">Register</button>' +
          '</div>' +
          '<div class="auth-error" id="auth-error"></div>' +

          // Login Form
          '<form class="auth-form" id="login-form">' +
            '<div class="form-group">' +
              '<label for="login-username">Username or Email</label>' +
              '<input type="text" id="login-username" class="input-field" placeholder="Username or email" autocomplete="username" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="login-password">Password</label>' +
              '<input type="password" id="login-password" class="input-field" placeholder="Enter password" autocomplete="current-password" required>' +
            '</div>' +
            '<a class="forgot-link" id="forgot-link">Forgot password?</a>' +
            '<button type="submit" class="btn btn-primary">Login</button>' +
          '</form>' +

          // Register Form
          '<form class="auth-form hidden" id="register-form">' +
            '<div class="form-group">' +
              '<label for="register-username">Username</label>' +
              '<input type="text" id="register-username" class="input-field" placeholder="Choose username" autocomplete="username" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="register-email">Email</label>' +
              '<input type="email" id="register-email" class="input-field" placeholder="your@email.com" autocomplete="email" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="register-password">Password</label>' +
              '<input type="password" id="register-password" class="input-field" placeholder="Choose password" autocomplete="new-password" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="register-confirm">Confirm Password</label>' +
              '<input type="password" id="register-confirm" class="input-field" placeholder="Confirm password" autocomplete="new-password" required>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary">Register</button>' +
          '</form>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    // Tab switching
    var tabs = container.querySelectorAll('.auth-tab');
    var loginForm = container.querySelector('#login-form');
    var registerForm = container.querySelector('#register-form');

    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var target = this.getAttribute('data-tab');

        for (var j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove('active');
        }
        this.classList.add('active');

        if (target === 'login') {
          loginForm.classList.remove('hidden');
          registerForm.classList.add('hidden');
        } else {
          loginForm.classList.add('hidden');
          registerForm.classList.remove('hidden');
        }

        clearError();
      });
    }

    // Forgot password link
    var forgotLink = container.querySelector('#forgot-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', function (e) {
        e.preventDefault();
        renderForgotPassword();
      });
    }

    // Login submit
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var identifier = container.querySelector('#login-username').value.trim();
      var password = container.querySelector('#login-password').value;

      if (!identifier || !password) {
        showError('Please fill in all fields.');
        return;
      }

      var submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier, password: password }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Login';

          if (data.ok) {
            localStorage.setItem('sessionId', data.sessionId);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.Othello.App.onAuthSuccess(data.user);
          } else {
            showError(data.error || 'Login failed.');
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Login';
          showError('Network error. Please try again.');
        });
    });

    // Register submit
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var username = container.querySelector('#register-username').value.trim();
      var email = container.querySelector('#register-email').value.trim();
      var password = container.querySelector('#register-password').value;
      var confirm = container.querySelector('#register-confirm').value;

      if (!username || !email || !password || !confirm) {
        showError('Please fill in all fields.');
        return;
      }

      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }

      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      var submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering...';

      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, email: email, password: password }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register';

          if (data.ok) {
            localStorage.setItem('sessionId', data.sessionId);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.Othello.App.onAuthSuccess(data.user);
          } else {
            showError(data.error || 'Registration failed.');
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register';
          showError('Network error. Please try again.');
        });
    });
  }

  function renderForgotPassword() {
    currentMode = 'forgot';

    var html = '' +
      '<div class="auth-container">' +
        '<h1 class="logo">OTHELLO</h1>' +
        '<div class="auth-card">' +
          '<p class="auth-subtitle">Reset your password</p>' +
          '<div class="auth-error" id="auth-error"></div>' +
          '<div class="auth-success" id="auth-success"></div>' +
          '<form class="auth-form" id="forgot-form">' +
            '<div class="form-group">' +
              '<label for="forgot-email">Email Address</label>' +
              '<input type="email" id="forgot-email" class="input-field" placeholder="your@email.com" autocomplete="email" required>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary">Send Reset Link</button>' +
          '</form>' +
          '<a class="forgot-link back-link" id="back-to-login">Back to login</a>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    var backLink = container.querySelector('#back-to-login');
    backLink.addEventListener('click', function (e) {
      e.preventDefault();
      renderAuthForm();
      fetchSsoConfig();
    });

    var forgotForm = container.querySelector('#forgot-form');
    forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      clearSuccess();

      var email = container.querySelector('#forgot-email').value.trim();
      if (!email) {
        showError('Please enter your email address.');
        return;
      }

      var submitBtn = forgotForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Reset Link';

          if (data.ok) {
            showSuccess('If that email is registered, a reset link has been sent. Check your inbox (or server console in dev mode).');
          } else {
            showError(data.error || 'Failed to send reset email.');
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Reset Link';
          showError('Network error. Please try again.');
        });
    });
  }

  function renderResetPassword(token) {
    currentMode = 'reset';

    var html = '' +
      '<div class="auth-container">' +
        '<h1 class="logo">OTHELLO</h1>' +
        '<div class="auth-card">' +
          '<p class="auth-subtitle">Set a new password</p>' +
          '<div class="auth-error" id="auth-error"></div>' +
          '<div class="auth-success" id="auth-success"></div>' +
          '<form class="auth-form" id="reset-form">' +
            '<div class="form-group">' +
              '<label for="reset-password">New Password</label>' +
              '<input type="password" id="reset-password" class="input-field" placeholder="New password" autocomplete="new-password" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="reset-confirm">Confirm Password</label>' +
              '<input type="password" id="reset-confirm" class="input-field" placeholder="Confirm password" autocomplete="new-password" required>' +
            '</div>' +
            '<button type="submit" class="btn btn-primary">Reset Password</button>' +
          '</form>' +
          '<a class="forgot-link back-link" id="back-to-login">Back to login</a>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    var backLink = container.querySelector('#back-to-login');
    backLink.addEventListener('click', function (e) {
      e.preventDefault();
      // Clean URL
      window.history.replaceState({}, document.title, '/');
      renderAuthForm();
      fetchSsoConfig();
    });

    var resetForm = container.querySelector('#reset-form');
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      clearSuccess();

      var password = container.querySelector('#reset-password').value;
      var confirm = container.querySelector('#reset-confirm').value;

      if (!password || !confirm) {
        showError('Please fill in all fields.');
        return;
      }

      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }

      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      var submitBtn = resetForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Resetting...';

      fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, password: password }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reset Password';

          if (data.ok) {
            showSuccess('Password reset successfully! Redirecting to login...');
            resetForm.style.display = 'none';
            setTimeout(function () {
              window.history.replaceState({}, document.title, '/');
              renderAuthForm();
              fetchSsoConfig();
            }, 2000);
          } else {
            showError(data.error || 'Failed to reset password.');
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reset Password';
          showError('Network error. Please try again.');
        });
    });
  }

  function showError(msg) {
    var el = container && container.querySelector('#auth-error');
    if (el) el.textContent = msg;
  }

  function clearError() {
    var el = container && container.querySelector('#auth-error');
    if (el) el.textContent = '';
  }

  function showSuccess(msg) {
    var el = container && container.querySelector('#auth-success');
    if (el) el.textContent = msg;
  }

  function clearSuccess() {
    var el = container && container.querySelector('#auth-success');
    if (el) el.textContent = '';
  }

  function destroy() {
    container = null;
  }

  window.Othello.AuthView = {
    render: render,
    destroy: destroy,
  };
})();
