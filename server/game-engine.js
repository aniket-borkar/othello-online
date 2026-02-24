'use strict';

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

function cloneBoard(b) {
  return b.map(r => [...r]);
}

function opponent(p) {
  return p === BLACK ? WHITE : BLACK;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getFlips(b, r, c, p) {
  if (b[r][c] !== EMPTY) return [];
  const opp = opponent(p);
  const allFlips = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && b[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && inBounds(nr, nc) && b[nr][nc] === p) {
      allFlips.push(...line);
    }
  }
  return allFlips;
}

function getValidMoves(b, p) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (getFlips(b, r, c, p).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

function applyMove(b, r, c, p) {
  const nb = cloneBoard(b);
  const flips = getFlips(nb, r, c, p);
  nb[r][c] = p;
  for (const [fr, fc] of flips) {
    nb[fr][fc] = p;
  }
  return { board: nb, flips };
}

function countDiscs(b) {
  let black = 0;
  let white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === BLACK) black++;
      else if (b[r][c] === WHITE) white++;
    }
  }
  return { black, white };
}

function isGameOver(b) {
  return getValidMoves(b, BLACK).length === 0 && getValidMoves(b, WHITE).length === 0;
}

module.exports = {
  EMPTY,
  BLACK,
  WHITE,
  DIRS,
  cloneBoard,
  opponent,
  inBounds,
  getFlips,
  getValidMoves,
  applyMove,
  countDiscs,
  isGameOver,
};
