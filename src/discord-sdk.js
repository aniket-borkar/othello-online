/**
 * src/discord-sdk.js
 * Discord Activity SDK integration.
 * Bundled by esbuild into public/js/discord-sdk.bundle.js
 */
import { DiscordSDK } from '@discord/embedded-app-sdk';

window.Othello = window.Othello || {};

var discordUser = null;
var discordAccessToken = null;
var discordSdk = null;

/**
 * Initialize the Discord SDK, perform OAuth, and return user info.
 */
async function initialize() {
  // Fetch client ID from server
  var configRes = await fetch('/api/discord-config');
  var config = await configRes.json();
  var clientId = config.clientId;
  if (!clientId) {
    throw new Error('Discord client ID not configured on server');
  }

  discordSdk = new DiscordSDK(clientId);

  // Wait for Discord client handshake
  await discordSdk.ready();

  // Request OAuth authorization from the user
  var authResult = await discordSdk.commands.authorize({
    client_id: clientId,
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
