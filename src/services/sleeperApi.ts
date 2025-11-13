export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  settings?: any;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: number;
  sport: string;
  status: string;
}

export interface NFLPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string;
  nfl_team?: string;
  status?: string;
}

export interface NFLGame {
  week: number;
  season: number;
  away_team: string;
  home_team: string;
  kickoff?: number;
  status?: string;
}

export interface PlayerInfo {
  name: string;
  position: string;
  league: string; // league name
  isStarter: boolean; // whether player is in starting lineup
}

export interface GameRecommendation {
  game: NFLGame;
  playerCount: number;
  players: PlayerInfo[];
}

export interface NFLState {
  week: number;
  season: number;
  season_type: string;
  leg: number;
}
