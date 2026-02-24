/**
 * app.js
 * SPA router and entry point. Manages view transitions.
 * Discord Activity only — no standalone auth.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var currentView = null; // 'lobby', 'game'
  var currentUser = null;

  function showView(name, data) {
    var appContainer = document.getElementById('app');
    if (!appContainer) return;

    // Destroy previous view
    if (currentView === 'lobby' && window.Othello.LobbyView) {
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
      case 'lobby':
        var user = data || getCurrentUser();
        window.Othello.LobbyView.render(appContainer, user);
        break;
      case 'game':
        window.Othello.GameView.render(appContainer, data || {});
        break;
      default:
        break;
    }

    // Trigger transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        appContainer.classList.add('view-active');
      });
    });
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
    var appContainer = document.getElementById('app');

    // Show loading state
    if (appContainer) {
      appContainer.innerHTML =
        '<div style="text-align:center;padding:4rem;color:#6b6b8d;">' +
        '<h1 class="logo">OTHELLO</h1>' +
        '<p style="margin-top:1rem;">Connecting to Discord...</p>' +
        '</div>';
    }

    // Initialize Discord SDK
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
        if (appContainer) {
          appContainer.innerHTML =
            '<div style="text-align:center;padding:3rem;color:#e0e0e0;">' +
            '<h2>Connection Error</h2>' +
            '<p>Failed to connect to Discord. Please try relaunching the activity.</p>' +
            '<p style="color:#6b6b8d;font-size:0.85rem;margin-top:1rem;">' + (err.message || '') + '</p>' +
            '</div>';
        }
      });
  });

  window.Othello.App = {
    showView: showView,
    getCurrentUser: getCurrentUser,
  };
})();
