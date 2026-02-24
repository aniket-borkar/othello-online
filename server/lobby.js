'use strict';

const crypto = require('crypto');

// Room storage: roomId -> Room object
const rooms = new Map();

// Quick-match queue: array of queued players
const queue = [];

/**
 * Create a new room.
 * @returns {object} The created room
 */
function createRoom(userId, username, elo, name) {
  const id = crypto.randomUUID();
  const room = {
    id,
    name: name || `${username}'s room`,
    hostId: userId,
    hostUsername: username,
    hostElo: elo,
    guestId: null,
    guestUsername: null,
    guestElo: null,
    status: 'waiting',
    createdAt: Date.now(),
  };
  rooms.set(id, room);
  return room;
}

/**
 * Join an existing room as a guest.
 * @returns {object|null} The updated room, or null if not found/joinable
 */
function joinRoom(roomId, userId, username, elo) {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.status !== 'waiting') return null;
  if (room.hostId === userId) return null;

  room.guestId = userId;
  room.guestUsername = username;
  room.guestElo = elo;
  room.status = 'full';
  return room;
}

/**
 * Leave a room. If host leaves, remove room. If guest leaves, revert to waiting.
 * @returns {{ removed: boolean, room: object|null }}
 */
function leaveRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return { removed: false, room: null };

  if (room.hostId === userId) {
    rooms.delete(roomId);
    return { removed: true, room };
  }

  if (room.guestId === userId) {
    room.guestId = null;
    room.guestUsername = null;
    room.guestElo = null;
    room.status = 'waiting';
    return { removed: false, room };
  }

  return { removed: false, room: null };
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function listRooms() {
  const result = [];
  for (const room of rooms.values()) {
    if (room.status === 'waiting' || room.status === 'full') {
      result.push(room);
    }
  }
  return result;
}

function removeRoom(roomId) {
  rooms.delete(roomId);
}

/**
 * Add a player to the quick-match queue.
 */
function addToQueue(userId, username, elo, socketId) {
  // Avoid duplicates
  const existing = queue.findIndex(q => q.userId === userId);
  if (existing !== -1) {
    queue[existing] = { userId, username, elo, socketId, joinedAt: Date.now() };
    return;
  }
  queue.push({ userId, username, elo, socketId, joinedAt: Date.now() });
}

/**
 * Remove a player from the quick-match queue.
 */
function removeFromQueue(userId) {
  const idx = queue.findIndex(q => q.userId === userId);
  if (idx !== -1) {
    queue.splice(idx, 1);
  }
}

/**
 * Find the closest ELO match in the queue for the given user.
 * @returns {object|null} The matched player entry, or null if no match found
 */
function findMatch(userId) {
  if (queue.length < 2) return null;

  const playerIdx = queue.findIndex(q => q.userId === userId);
  if (playerIdx === -1) return null;

  const player = queue[playerIdx];
  let bestIdx = -1;
  let bestDiff = Infinity;

  for (let i = 0; i < queue.length; i++) {
    if (i === playerIdx) continue;
    const diff = Math.abs(queue[i].elo - player.elo);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return null;

  const matched = queue[bestIdx];

  // Remove both from queue (remove higher index first to avoid index shift)
  const indicesToRemove = [playerIdx, bestIdx].sort((a, b) => b - a);
  for (const idx of indicesToRemove) {
    queue.splice(idx, 1);
  }

  return matched;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  listRooms,
  removeRoom,
  addToQueue,
  removeFromQueue,
  findMatch,
};
