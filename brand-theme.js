/* Shared display colors. Identity only: gold for public rooms, gray for the private office. */
(function (root) {
  'use strict';
  const GOLD = '#D0B993';
  const GOLD_LIGHT = '#E6D8C3';
  const GOLD_MID = '#A98B5E';
  const GOLD_DARK = '#8A7049';
  const GOLD_INK = '#3A3024';
  const PRIVATE = '#AEB7C2';
  const PRIVATE_LIGHT = '#D5DAE1';
  const PRIVATE_DARK = '#7F8996';

  function isPrivate(team, flag) {
    if (flag === true) return true;
    if (team && typeof team === 'object') return !!(team.private || team.id === 'privfin');
    return team === 'privfin';
  }
  function teamColor(team) {
    return isPrivate(team) ? PRIVATE : GOLD;
  }
  function areaColor(id, priv) {
    return (priv || id === 'privfin') ? PRIVATE : GOLD;
  }

  const api = {
    GOLD, GOLD_LIGHT, GOLD_MID, GOLD_DARK, GOLD_INK,
    PRIVATE, PRIVATE_LIGHT, PRIVATE_DARK,
    isPrivate, teamColor, areaColor,
  };
  root.EvergateBrand = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
