'use strict';

const K = 32;

/**
 * Calculate new ELO ratings after a game.
 * @param {number} ratingA - Player A's current rating
 * @param {number} ratingB - Player B's current rating
 * @param {number} scoreA - Player A's score: 1 = win, 0 = loss, 0.5 = draw
 * @returns {{ newA: number, newB: number }}
 */
function calculateNewRatings(ratingA, ratingB, scoreA) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const scoreB = 1 - scoreA;

  const newA = Math.round(ratingA + K * (scoreA - expectedA));
  const newB = Math.round(ratingB + K * (scoreB - expectedB));

  return { newA, newB };
}

module.exports = { calculateNewRatings };
