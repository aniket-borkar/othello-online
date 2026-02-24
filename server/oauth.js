'use strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// --- Google ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = `${BASE_URL}/auth/google/callback`;

function getGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function handleGoogleCallback(code) {
  // Exchange code for token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Failed to get Google access token');

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  return {
    email: user.email,
    name: user.name || user.email.split('@')[0],
    oauthId: String(user.id),
  };
}

// --- Discord ---
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = `${BASE_URL}/auth/discord/callback`;

function getDiscordAuthUrl() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

async function handleDiscordCallback(code) {
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      redirect_uri: DISCORD_REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Failed to get Discord access token');

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  return {
    email: user.email || null,
    name: user.global_name || user.username || 'Player',
    oauthId: String(user.id),
  };
}

function isGoogleConfigured() { return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET); }
function isDiscordConfigured() { return !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET); }

module.exports = {
  getGoogleAuthUrl, handleGoogleCallback, isGoogleConfigured,
  getDiscordAuthUrl, handleDiscordCallback, isDiscordConfigured,
};
