/**
 * app.js
 * SPA router and entry point. Manages view transitions.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var currentView = null; // 'auth', 'lobby', 'game'
  var currentUser = null;

  function showView(name, data) {
    var appContainer = document.getElementById('app');
    if (!appContainer) return;

    // Destroy previous view
    if (currentView === 'auth' && window.Othello.AuthView) {
      window.Othello.AuthView.destroy();
    } else if (currentView === 'lobby' && window.Othello.LobbyView) {
      window.Othello.LobbyView.destroy();
    } else if (currentView === 'game' && window.Othello.GameView) {
      window.Othello.GameView.destroy();
    }

    // Clear container
    appContainer.innerHTML = '';
    currentView = name;

    // Add transition classes
    appContainer.classList.add('view-enter');
    appContainer.classList.remove('view-active');

    // Render the new view
    switch (name) {
      case 'auth':
        window.Othello.AuthView.render(appContainer, data);
        break;
      case 'lobby':
        var user = data || getCurrentUser();
        window.Othello.LobbyView.render(appContainer, user);
        break;
      case 'game':
        window.Othello.GameView.render(appContainer, data || {});
        break;
      default:
        window.Othello.AuthView.render(appContainer);
        break;
    }

    // Trigger transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        appContainer.classList.add('view-active');
      });
    });
  }

  function onAuthSuccess(user) {
    currentUser = user;
    var sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      window.Othello.Socket.connect(sessionId);
    }
    showView('lobby', user);
  }

  function onConnected() {
    // Socket connected successfully - could update UI indicators
  }

  function getCurrentUser() {
    if (currentUser) return currentUser;
    try {
      var stored = localStorage.getItem('user');
      if (stored) {
        currentUser = JSON.parse(stored);
        return currentUser;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // --- Initialize on DOMContentLoaded ---
  document.addEventListener('DOMContentLoaded', function () {
    // --- Discord Activity Mode ---
    if (window.Othello.Discord && window.Othello.Discord.isDiscordMode()) {
      window.Othello.Discord.initialize()
        .then(function (result) {
          var user = result.appUser;
          currentUser = user;
          localStorage.setItem('sessionId', result.sessionId);
          localStorage.setItem('user', JSON.stringify(user));

          window.Othello.Socket.connect(result.sessionId);
          showView('lobby', user);
        })
        .catch(function (err) {
          console.error('Discord SDK init failed:', err);
          var appContainer = document.getElementById('app');
          if (appContainer) {
            appContainer.innerHTML =
              '<div style="text-align:center;padding:3rem;color:#e0e0e0;">' +
              '<h2>Connection Error</h2>' +
              '<p>Failed to connect to Discord. Please try relaunching the activity.</p>' +
              '</div>';
          }
        });
      return;
    }

    // --- Standalone Mode ---
    var params = new URLSearchParams(window.location.search);

    // Handle OAuth callback redirect: /?sessionId=xxx&username=xxx&elo=xxx
    var oauthSessionId = params.get('sessionId');
    if (oauthSessionId) {
      var username = params.get('username') || 'Player';
      var elo = parseInt(params.get('elo'), 10) || 1200;
      var userId = params.get('userId');

      var user = { id: userId, username: username, elo: elo };
      localStorage.setItem('sessionId', oauthSessionId);
      localStorage.setItem('user', JSON.stringify(user));

      // Clean URL
      window.history.replaceState({}, document.title, '/');

      currentUser = user;
      window.Othello.Socket.connect(oauthSessionId);
      showView('lobby', user);
      return;
    }

    // Handle password reset link: /?reset=TOKEN
    var resetToken = params.get('reset');
    if (resetToken) {
      showView('auth', { mode: 'reset', token: resetToken });
      return;
    }

    // Handle OAuth error
    var error = params.get('error');
    if (error) {
      window.history.replaceState({}, document.title, '/');
      // Show auth with error — will display after render
      showView('auth');
      return;
    }

    // Normal flow: check for existing session
    var sessionId = localStorage.getItem('sessionId');
    var storedUser = null;

    try {
      var raw = localStorage.getItem('user');
      if (raw) storedUser = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    if (sessionId && storedUser) {
      currentUser = storedUser;
      window.Othello.Socket.connect(sessionId);
      showView('lobby', storedUser);
    } else {
      showView('auth');
    }
  });

  window.Othello.App = {
    showView: showView,
    onAuthSuccess: onAuthSuccess,
    onConnected: onConnected,
    getCurrentUser: getCurrentUser,
  };
})();
