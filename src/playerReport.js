// src/playerReport.js
import { SoccerPlayer, HockeyPlayer, BasketballPlayer } from '@/types/Player';
import { BasePlayer } from '@/classes/BasePlayer';

export function generatePlayerReport(player) {
  if (player instanceof SoccerPlayer) {
    return generateSoccerPlayerReport(player);
  } else if (player instanceof HockeyPlayer) {
    return generateHockeyPlayerReport(player);
  } else if (player instanceof BasketballPlayer) {
    return generateBasketballPlayerReport(player);
  } else {
    throw new Error('Unsupported player type');
  }
}

function generateSoccerPlayerReport(player) {
  // Placeholder for soccer player report generation
  return {
    name: player.name,
    age: player.age,
    overall: player.overall,
    skills: player.skills,
    positions: player.positions,
  };
}

function generateHockeyPlayerReport(player) {
  // Placeholder for hockey player report generation
  return {
    name: player.name,
    age: player.age,
    overall: player.overall,
    skills: player.skills,
    positions: player.positions,
  };
}

function generateBasketballPlayerReport(player) {
  // Placeholder for basketball player report generation
  return {
    name: player.name,
    age: player.age,
    overall: player.overall,
    skills: player.skills,
    positions: player.positions,
  };
}
