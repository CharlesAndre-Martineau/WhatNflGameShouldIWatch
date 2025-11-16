import axios from 'axios';
import { SleeperLeague, GameRecommendation } from './sleeperApi';

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

// ESPN Team ID to NFL Abbreviation Mapping
// Based on ESPN's team ID system
const ESPN_TEAM_ID_MAP: Record<string, string> = {
  '1': 'ATL',   // Atlanta Falcons
  '2': 'BUF',   // Buffalo Bills
  '3': 'BAL',   // Baltimore Ravens
  '4': 'PHI',   // Philadelphia Eagles
  '5': 'DET',   // Detroit Lions
  '6': 'CHI',   // Chicago Bears
  '7': 'NYG',   // New York Giants
  '8': 'CLE',   // Cleveland Browns
  '9': 'MIA',   // Miami Dolphins
  '10': 'SEA',  // Seattle Seahawks
  '11': 'WAS',  // Washington Commanders
  '12': 'NE',   // New England Patriots
  '13': 'GB',   // Green Bay Packers
  '14': 'TB',   // Tampa Bay Buccaneers
  '15': 'IND',  // Indianapolis Colts
  '16': 'TEN',  // Tennessee Titans
  '17': 'NO',   // New Orleans Saints
  '18': 'LAC',  // Los Angeles Chargers
  '19': 'NYJ',  // New York Jets
  '20': 'DEN',  // Denver Broncos
  '21': 'MIN',  // Minnesota Vikings
  '22': 'KC',   // Kansas City Chiefs
  '23': 'LAR',  // Los Angeles Rams
  '24': 'PIT',  // Pittsburgh Steelers
  '25': 'ARI',  // Arizona Cardinals
  '26': 'CIN',  // Cincinnati Bengals
  '27': 'LV',   // Las Vegas Raiders
  '28': 'SF',   // San Francisco 49ers
  '29': 'CAR',  // Carolina Panthers
  '30': 'JAC',  // Jacksonville Jaguars
  '31': 'HOU',  // Houston Texans
  '32': 'DAL',  // Dallas Cowboys
  '33': 'TB',   // Tampa Bay Buccaneers (backup)
  '34': 'KC',   // Kansas City Chiefs (backup)
};

// Cache for players data to avoid repeated large API calls
let playersCache: Record<string, any> = {};
let playersCacheTime = 0;
const CACHE_DURATION = 3600000; // 1 hour

/**
 * Get all fantasy teams for a user across all leagues
 */
export async function getUserFantasyTeams(
  userId: string,
  season: number
): Promise<SleeperLeague[]> {
  const response = await axios.get(
    `${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${season}`
  );
  return response.data;
}

/**
 * Get matchups for a league in a specific week
 */
export async function getLeagueMatchups(
  leagueId: string,
  week: number
): Promise<any[]> {
  try {
    const response = await axios.get(
      `${SLEEPER_API_BASE}/league/${leagueId}/matchups/${week}`
    );
    return response.data;
  } catch (error) {
    console.warn(`Error fetching matchups for league ${leagueId} week ${week}:`, error);
    return [];
  }
}

/**
 * Get user information by user ID
 */
export async function getSleeperUser(userId: string): Promise<any> {
  try {
    const response = await axios.get(
      `${SLEEPER_API_BASE}/user/${userId}`
    );
    return response.data;
  } catch (error) {
    console.warn(`Error fetching user ${userId}:`, error);
    return null;
  }
}

/**
 * Get all players data with caching
 */
export async function getAllPlayersData(): Promise<Record<string, any>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (Object.keys(playersCache).length > 0 && (now - playersCacheTime) < CACHE_DURATION) {
    return playersCache;
  }

  const response = await axios.get(`${SLEEPER_API_BASE}/players/nfl`);
  playersCache = response.data;
  playersCacheTime = now;
  
  return playersCache;
}

/**
 * Get NFL schedule for current week using ESPN API
 */
export async function getWeekGamesFromESPN(season: number, week: number): Promise<any[]> {
  try {
    const eventsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/types/2/weeks/${week}/events`;
    const response = await axios.get(eventsUrl);
    
    if (!response.data.items || response.data.items.length === 0) {
      return [];
    }

    // Fetch detailed event data for each game
    const gamePromises = response.data.items.map((item: any) => {
      // Extract game ID from the $ref URL
      const gameId = item.$ref.match(/events\/(\d+)/)?.[1];
      if (!gameId) return null;
      
      return axios.get(
        `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${gameId}`
      );
    }).filter(Boolean);

    const gameResponses = await Promise.all(gamePromises);
    
    const games = gameResponses.map((response) => {
      const event = response.data;
      if (!event.competitions || event.competitions.length === 0) {
        return null;
      }

      const competition = event.competitions[0];
      const competitors = competition.competitors || [];
      
      let homeTeam = '';
      let awayTeam = '';

      // Extract team abbreviations using ESPN team ID mapping
      competitors.forEach((competitor: any) => {
        const teamId = String(competitor.id);
        const teamAbbr = ESPN_TEAM_ID_MAP[teamId] || '';
        
        console.log(`Debug ESPN Competitor: ID=${teamId}, Mapped=${teamAbbr}, HomeAway=${competitor.homeAway}`);
        
        if (competitor.homeAway === 'home') {
          homeTeam = teamAbbr;
        } else if (competitor.homeAway === 'away') {
          awayTeam = teamAbbr;
        }
      });

      console.log(`Debug ESPN: Event ${event.id} - Away: ${awayTeam}, Home: ${homeTeam}`);

      return {
        week,
        season,
        away_team: awayTeam,
        home_team: homeTeam,
        kickoff: event.date ? new Date(event.date).getTime() : 0,
        status: competition.status?.type || 'scheduled',
        name: event.name || `${awayTeam} @ ${homeTeam}`,
      };
    }).filter(Boolean);

    return games;
  } catch (error) {
    console.error('Error fetching NFL schedule from ESPN:', error);
    return [];
  }
}

/**
 * Get current NFL state (week, season)
 */
export async function getNFLState(): Promise<any> {
  const response = await axios.get(`${SLEEPER_API_BASE}/state/nfl`);
  return response.data;
}

/**
 * Analyze rosters and find the top N games with most players
 */
export async function getRecommendedGames(
  userId: string,
  numberOfGames: number = 1,
  onlyStarters: boolean = false,
  includeOpponents: boolean = false,
  selectedWeek?: number
): Promise<GameRecommendation[]> {
  try {
    // Get current NFL state for season
    const nflState = await getNFLState();
    const season = nflState.season;
    
    // Use selected week or current week from Sleeper API
    let currentWeek = selectedWeek || nflState.week;
    
    console.log(`Debug: NFL State - Season: ${season}, Week: ${nflState.week}`);
    
    // If we're in off-season (week > 18), adjust to fetch the actual current week
    // The NFL regular season is weeks 1-18
    if (currentWeek > 18) {
      // We're likely in post-season or off-season
      // Try to use week 1 for the current active season
      currentWeek = 1;
      console.log(`Debug: Off-season detected, adjusted week to: ${currentWeek}`);
    }

    // Get all leagues for user
    const leagues = await getUserFantasyTeams(userId, season);
    
    console.log('Debug: Leagues found =', leagues.length);
    if (leagues.length === 0) {
      console.warn('No leagues found for user');
      return [];
    }

    // Get all players data once
    const allPlayers = await getAllPlayersData();

    // Collect all players from all leagues, but only count each player once per NFL team
    const playerGameMap = new Map<string, number>(); // NFL team -> count
    const playerDetailsMap = new Map<string, Array<{ name: string; position: string; league: string; isStarter: boolean; isOpponent?: boolean; ownerName?: string }>>(); // NFL team -> player_info
    const uniquePlayers = new Set<string>(); // Track unique player IDs
    const opponentDetailsMap = new Map<string, Array<{ name: string; position: string; league: string; isStarter: boolean; isOpponent: boolean; ownerName: string }>>(); // NFL team -> opponent player_info

    for (const league of leagues) {
      try {
        // Get matchups for this league to determine the current week
        let matchupWeek: number | null = null;
        let matchups: any[] = [];
        
        // Try to find a week with matchups in this league (typically weeks 1-17 for standard leagues)
        for (let week = currentWeek; week <= currentWeek + 5; week++) {
          const weekMatchups = await getLeagueMatchups(league.league_id, week);
          if (weekMatchups && weekMatchups.length > 0) {
            // Validate that league has exactly one matchup per team (standard league format)
            // A standard league should have matchups array where each matchup has two rosters
            const rosterIds = new Set<number>();
            weekMatchups.forEach((m: any) => {
              if (m.roster_id) rosterIds.add(m.roster_id);
            });
            
            // If we have matchups and they look valid (not empty), use this week
            if (rosterIds.size > 0) {
              matchups = weekMatchups;
              matchupWeek = week;
              console.log(`Debug: League ${league.league_id} (${league.name}) - Found matchups for week ${week}`);
              break;
            }
          }
        }
        
        // Skip leagues that don't have valid matchups (non-standard leagues, or league type issues)
        if (matchupWeek === null || matchups.length === 0) {
          console.warn(`Debug: League ${league.league_id} (${league.name}) - No valid matchups found, skipping`);
          continue;
        }
        
        // Get rosters for this league
        const rostersResponse = await axios.get(
          `${SLEEPER_API_BASE}/league/${league.league_id}/rosters`
        );

        // Find user's roster (match by owner_id)
        const userRoster = rostersResponse.data.find(
          (r: any) => r.owner_id === userId
        );

        console.log(`Debug: League ${league.league_id} (${league.name}) - Roster found: ${!!userRoster}`);
        if (!userRoster) {
          console.warn(`No roster found for user in league ${league.league_id}`);
          continue;
        }

        if (!userRoster.players || userRoster.players.length === 0) {
          console.log(`Debug: League ${league.league_id} - Skipping (no players)`);
          continue;
        }

        console.log(`Debug: League ${league.league_id} (${league.name}) - Players: ${userRoster.players.length}`);
        console.log(`Debug: League ${league.league_id} - Starters: ${userRoster.starters?.length || 0}`);

        // Count players by their NFL team, only if not already counted
        userRoster.players.forEach((playerId: string) => {
          if (uniquePlayers.has(playerId)) return; // Skip if already counted
          uniquePlayers.add(playerId);
          const player = allPlayers[playerId];
          if (player && player.team) {
            const nflTeam = player.team;
            playerGameMap.set(nflTeam, (playerGameMap.get(nflTeam) || 0) + 1);

            if (!playerDetailsMap.has(nflTeam)) {
              playerDetailsMap.set(nflTeam, []);
            }

            const playerName = player.first_name && player.last_name
              ? `${player.first_name} ${player.last_name}`
              : player.full_name || playerId;

            const position = player.position || 'N/A';
            const leagueName = league.name || `League ${league.league_id}`;
            const isStarter = userRoster.starters?.includes(playerId) || false;

            playerDetailsMap.get(nflTeam)!.push({ name: playerName, position, league: leagueName, isStarter, isOpponent: false, ownerName: 'You' });
          }
        });

        // Process opponent rosters if includeOpponents is true
        if (includeOpponents) {
          // Find the user's matchup for this week to identify their actual opponent
          const userMatchup = matchups.find((m: any) => m.roster_id === userRoster.roster_id);
          
          if (userMatchup && userMatchup.matchup_id) {
            // Find all other rosters with the same matchup_id (should be exactly 1 in a 1v1 league)
            const opponentMatchups = matchups.filter((m: any) => 
              m.roster_id !== userRoster.roster_id && m.matchup_id === userMatchup.matchup_id
            );
            
            // Only process opponent if there's exactly one other roster with same matchup_id (standard 1v1 matchup)
            if (opponentMatchups.length === 1) {
              const opponentRosterId = opponentMatchups[0].roster_id;
              
              // Find the opponent's roster
              const opponentRoster = rostersResponse.data.find(
                (r: any) => r.roster_id === opponentRosterId
              );
              
              if (opponentRoster && opponentRoster.players && opponentRoster.players.length > 0) {
                // Fetch opponent user info
                const userInfo = await getSleeperUser(opponentRoster.owner_id);
                const opponentUsername = userInfo?.username || opponentRoster.owner?.display_name || `Owner ${opponentRoster.owner_id}`;
                
                // Count opponent players - skip if already counted
                opponentRoster.players.forEach((playerId: string) => {
                  if (uniquePlayers.has(playerId)) return; // Skip if already counted
                  const player = allPlayers[playerId];
                  if (player && player.team) {
                    const nflTeam = player.team;
                    playerGameMap.set(nflTeam, (playerGameMap.get(nflTeam) || 0) + 1);

                    if (!opponentDetailsMap.has(nflTeam)) {
                      opponentDetailsMap.set(nflTeam, []);
                    }

                    const playerName = player.first_name && player.last_name
                      ? `${player.first_name} ${player.last_name}`
                      : player.full_name || playerId;

                    const position = player.position || 'N/A';
                    const leagueName = league.name || `League ${league.league_id}`;
                    const isStarter = opponentRoster.starters?.includes(playerId) || false;

                    opponentDetailsMap.get(nflTeam)!.push({ name: playerName, position, league: leagueName, isStarter, isOpponent: true, ownerName: opponentUsername });
                  }
                });
              }
            } else if (opponentMatchups.length === 0) {
              console.warn(`Debug: League ${league.league_id} (${league.name}) - No opponent found (best ball or other league type)`);
            } else {
              console.warn(`Debug: League ${league.league_id} (${league.name}) - Multiple opponents found in same matchup (not a 1v1 league), skipping opponent inclusion`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing league ${league.league_id}:`, error);
        continue;
      }
    }

    // Find NFL teams sorted by player count
    const teamsWithPlayerCounts: Array<[string, number]> = [];
    playerGameMap.forEach((count, team) => {
      teamsWithPlayerCounts.push([team, count]);
    });
    
    // Sort by player count descending
    teamsWithPlayerCounts.sort((a, b) => b[1] - a[1]);

    if (teamsWithPlayerCounts.length === 0) {
      return [];
    }

    // Get games for current week from ESPN
    // Try to find games that are actually this week (November 2025)
    let games: any[] = [];
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const twoWeeksAgo = now - oneWeekMs;
    const fourWeeksFromNow = now + (4 * oneWeekMs);
    
    // Try multiple weeks to find games that are actually in the current timeframe
    for (let i = 0; i < 5; i++) {
      const tryWeek = currentWeek + i;
      const weekGames = await getWeekGamesFromESPN(season, tryWeek);
      console.log(`Debug: Week ${tryWeek} - Found ${weekGames.length} games`);
      
      // Check if any games are in the current timeframe (this week)
      const recentGames = weekGames.filter((game: any) => {
        return game.kickoff >= twoWeeksAgo && game.kickoff <= fourWeeksFromNow;
      });
      
      if (recentGames.length > 0) {
        console.log(`Debug: Found ${recentGames.length} games in current timeframe at week ${tryWeek}`);
        games = recentGames;
        currentWeek = tryWeek;
        break;
      }
    }
    
    console.log('Debug: currentWeek =', currentWeek);
    console.log('Debug: Total games fetched =', games.length);
    console.log('Debug: Games data:', games.map(g => ({ away: g.away_team, home: g.home_team, kickoff: new Date(g.kickoff).toISOString() })));
    console.log('Debug: Player counts by team:', Array.from(playerGameMap.entries()));
    
    // Build a map of games to player counts (either team in the game)
    const gamePlayerCounts: Array<{game: any, playerCount: number, teams: string[], starterCount?: number}> = [];
    
    for (const game of games) {
      const awayTeamCount = playerGameMap.get(game.away_team) || 0;
      const homeTeamCount = playerGameMap.get(game.home_team) || 0;
      const totalPlayerCount = awayTeamCount + homeTeamCount;
      
      // Only include games that have at least one of your players (or opponent players if includeOpponents)
      if (totalPlayerCount > 0) {
        const teamsWithPlayers = [];
        if (awayTeamCount > 0) teamsWithPlayers.push(game.away_team);
        if (homeTeamCount > 0) teamsWithPlayers.push(game.home_team);
        
        // Calculate player counts including opponents if enabled
        let displayPlayerCount = totalPlayerCount;
        let starterCount = 0;
        
        if (includeOpponents) {
          // Count opponent players too
          for (const team of teamsWithPlayers) {
            const opponentPlayers = opponentDetailsMap.get(team) || [];
            displayPlayerCount += opponentPlayers.length;
          }
        }
        
        if (onlyStarters) {
          for (const team of teamsWithPlayers) {
            // Count both user and opponent starters
            const teamPlayers = playerDetailsMap.get(team) || [];
            starterCount += teamPlayers.filter(p => p.isStarter).length;
            
            if (includeOpponents) {
              const opponentPlayers = opponentDetailsMap.get(team) || [];
              starterCount += opponentPlayers.filter(p => p.isStarter).length;
            }
          }
        }
        
        gamePlayerCounts.push({
          game,
          playerCount: displayPlayerCount,
          teams: teamsWithPlayers,
          starterCount
        });
      }
    }
    
    // Sort games by player count (descending)
    // If onlyStarters is true, sort by starter count; otherwise sort by total count (including opponents if enabled)
    gamePlayerCounts.sort((a, b) => {
      if (onlyStarters) {
        return (b.starterCount || 0) - (a.starterCount || 0);
      } else {
        return b.playerCount - a.playerCount;
      }
    });
    
    console.log(`Debug: Games with your players: ${gamePlayerCounts.length}`);
    gamePlayerCounts.forEach((g, idx) => {
      const countToShow = onlyStarters ? g.starterCount : g.playerCount;
      console.log(`  ${idx + 1}. ${g.game.away_team} @ ${g.game.home_team} (${countToShow} players from ${g.teams.join(', ')})`);
    });
    
    // Find games for the top N games with most players
    const recommendations: GameRecommendation[] = [];
    const maxGamesToRecommend = Math.min(numberOfGames, gamePlayerCounts.length);
    
    for (let i = 0; i < maxGamesToRecommend; i++) {
      const { game, playerCount, teams } = gamePlayerCounts[i];
      
      // Combine players from all teams in this game
      const allPlayersInGame: Array<{ name: string; position: string; league: string; isStarter: boolean; isOpponent?: boolean; ownerName?: string }> = [];
      for (const team of teams) {
        const teamPlayers = playerDetailsMap.get(team) || [];
        allPlayersInGame.push(...teamPlayers);
        
        // Add opponent players if includeOpponents is enabled
        if (includeOpponents) {
          const opponentPlayers = opponentDetailsMap.get(team) || [];
          allPlayersInGame.push(...opponentPlayers);
        }
      }
      
      recommendations.push({
        game: game,
        playerCount: playerCount,
        players: allPlayersInGame,
      });
    }

    if (recommendations.length === 0) {
      console.warn('No games found with any of your players in the current timeframe');
      return [];
    }

    return recommendations;
  } catch (error) {
    console.error('Error fetching recommended games:', error);
    throw error;
  }
}

// Backwards compatibility: keep the old single-game function
export async function getRecommendedGame(
  userId: string
): Promise<GameRecommendation | null> {
  const recommendations = await getRecommendedGames(userId, 1, true);
  return recommendations.length > 0 ? recommendations[0] : null;
}
