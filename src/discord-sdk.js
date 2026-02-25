/**
 * src/discord-sdk.js
 * Discord Activity SDK integration.
 * Bundled by esbuild into public/js/discord-sdk.bundle.js
 */
import { DiscordSDK } from '@discord/embedded-app-sdk';

window.Othello = window.Othello || {};

var CLIENT_ID = '1475850052823158866';
var discordUser = null;
var discordAccessToken = null;

// Create SDK instance immediately at module scope (not deferred).
var discordSdk = null;
try {
  discordSdk = new DiscordSDK(CLIENT_ID);
  if (window._dbg) window._dbg('DiscordSDK constructed OK, clientId=' + CLIENT_ID);
} catch (e) {
  if (window._dbg) window._dbg('DiscordSDK constructor FAILED: ' + e.message);
}

/**
 * Initialize the Discord SDK, perform OAuth, and return user info.
 */
async function initialize() {
  if (!discordSdk) {
    throw new Error('DiscordSDK failed to construct — check debug log');
  }
  // Wait for Discord client handshake
  if (window._dbg) window._dbg('Calling discordSdk.ready()...');
  await discordSdk.ready();
  if (window._dbg) window._dbg('ready() succeeded');

  // Request OAuth authorization from the user
  var authResult = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });

  // Exchange code for access token via our server
  var response = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: authResult.code }),
  });
  var data = await response.json();

  if (!data.access_token) {
    throw new Error(data.error || 'Failed to get access token from server');
  }

  discordAccessToken = data.access_token;

  // Authenticate with the Discord client
  var auth = await discordSdk.commands.authenticate({
    access_token: discordAccessToken,
  });

  discordUser = auth.user;

  return {
    user: discordUser,
    accessToken: discordAccessToken,
    sessionId: data.sessionId,
    appUser: data.user,
  };
}

function getUser() {
  return discordUser;
}

function getSdk() {
  return discordSdk;
}

window.Othello.Discord = {
  initialize: initialize,
  getUser: getUser,
  getSdk: getSdk,
};
