import axios from 'axios';
import { SleeperLeague, GameRecommendation, PlayerInfo } from './sleeperApi';

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
const ESPN_TEAM_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const espnTeamAbbreviationCache = new Map<string, { abbreviation: string; cachedAt: number }>();

const SCORE_WEIGHTS = {
  USER_STARTER: 2.5,
  USER_BENCH: 0.25,
  OPPONENT_STARTER: 1,
  OPPONENT_BENCH: 0,
  BOTH_TEAMS_HAVE_PLAYERS_BONUS: 0.5,
};

function ensureHttpsUrl(url?: string): string {
  if (!url) {
    return '';
  }

  return url.replace(/^http:\/\//i, 'https://');
}

function isDefensePosition(position?: string): boolean {
  if (!position) {
    return false;
  }

  const normalized = position.toUpperCase();
  return normalized === 'DEF' || normalized === 'DST';
}

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

    const resolveTeamAbbreviation = async (competitor: any): Promise<string> => {
      const teamRef = competitor?.team?.$ref;
      if (teamRef) {
        const normalizedTeamRef = ensureHttpsUrl(teamRef);
        const cached = espnTeamAbbreviationCache.get(normalizedTeamRef);
        const now = Date.now();
        if (cached && (now - cached.cachedAt) < ESPN_TEAM_CACHE_DURATION) {
          return cached.abbreviation;
        }

        try {
          const teamResponse = await axios.get(normalizedTeamRef);
          const abbreviation = teamResponse.data?.abbreviation || '';
          if (abbreviation) {
            espnTeamAbbreviationCache.set(normalizedTeamRef, { abbreviation, cachedAt: now });
            return abbreviation;
          }
        } catch (error) {
          console.warn('Error resolving ESPN team abbreviation:', error);
        }
      }

      // Fallback for robustness if team ref cannot be resolved.
      const teamId = String(competitor?.id || '');
      return ESPN_TEAM_ID_MAP[teamId] || '';
    };

    const games = await Promise.all(gameResponses.map(async (response) => {
      const event = response.data;
      if (!event.competitions || event.competitions.length === 0) {
        return null;
      }

      const competition = event.competitions[0];
      const competitors = competition.competitors || [];
      
      let homeTeam = '';
      let awayTeam = '';

      for (const competitor of competitors) {
        const teamAbbr = await resolveTeamAbbreviation(competitor);

        if (competitor.homeAway === 'home') {
          homeTeam = teamAbbr;
        } else if (competitor.homeAway === 'away') {
          awayTeam = teamAbbr;
        }
      }

      if (!homeTeam || !awayTeam) {
        return null;
      }

      return {
        week,
        season,
        away_team: awayTeam,
        home_team: homeTeam,
        kickoff: event.date ? new Date(event.date).getTime() : 0,
        status: competition.status?.type || 'scheduled',
        name: event.name || `${awayTeam} @ ${homeTeam}`,
      };
    }));

    return games.filter(Boolean);
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
  selectedWeek?: number,
  leagueFilter?: string,
  doubleCount: boolean = true,
  excludeDefense: boolean = false
): Promise<GameRecommendation[]> {
  try {
    const nflState = await getNFLState();
    const season = nflState.season;
    let currentWeek = selectedWeek || nflState.week;
    const hasExplicitWeekSelection = typeof selectedWeek === 'number';

    if (currentWeek > 18) {
      currentWeek = 1;
    }

    const leagues = await getUserFantasyTeams(userId, season);
    if (leagues.length === 0) {
      return [];
    }

    const allPlayers = await getAllPlayersData();

    const userTeamCountMap = new Map<string, number>();
    const opponentTeamCountMap = new Map<string, number>();
    const playerDetailsMap = new Map<string, PlayerInfo[]>();
    const opponentDetailsMap = new Map<string, PlayerInfo[]>();
    const globallyCountedUserPlayers = new Set<string>();
    const globallyCountedOpponentPlayers = new Set<string>();

    for (const league of leagues) {
      try {
        if (leagueFilter && league.name !== leagueFilter) {
          continue;
        }

        const rostersResponse = await axios.get(
          `${SLEEPER_API_BASE}/league/${league.league_id}/rosters`
        );

        const userRoster = rostersResponse.data.find(
          (r: any) => r.owner_id === userId
        );
        if (!userRoster) {
          continue;
        }

        if (!userRoster.players || userRoster.players.length === 0) {
          continue;
        }

        const seenUserPlayersInLeague = new Set<string>();
        userRoster.players.forEach((playerId: string) => {
          if (seenUserPlayersInLeague.has(playerId)) return;
          if (!doubleCount && globallyCountedUserPlayers.has(playerId)) return;

          seenUserPlayersInLeague.add(playerId);
          globallyCountedUserPlayers.add(playerId);
          const player = allPlayers[playerId];
          const nflTeam = player?.team || player?.nfl_team;
          const position = player?.position || 'N/A';

          if (excludeDefense && isDefensePosition(position)) {
            return;
          }

          if (player && nflTeam) {
            userTeamCountMap.set(nflTeam, (userTeamCountMap.get(nflTeam) || 0) + 1);

            if (!playerDetailsMap.has(nflTeam)) {
              playerDetailsMap.set(nflTeam, []);
            }

            const playerName = player.first_name && player.last_name
              ? `${player.first_name} ${player.last_name}`
              : player.full_name || playerId;

            const leagueName = league.name || `League ${league.league_id}`;
            const isStarter = userRoster.starters?.includes(playerId) || false;

            playerDetailsMap.get(nflTeam)!.push({
              name: playerName,
              position,
              league: leagueName,
              isStarter,
              isOpponent: false,
              ownerName: 'You',
            });
          }
        });

        if (includeOpponents) {
          let matchups: any[] = [];
          const candidateWeeks = hasExplicitWeekSelection
            ? [currentWeek]
            : [currentWeek, currentWeek + 1, currentWeek + 2, currentWeek + 3, currentWeek + 4, currentWeek + 5];

          for (const week of candidateWeeks) {
            const weekMatchups = await getLeagueMatchups(league.league_id, week);
            if (weekMatchups && weekMatchups.length > 0) {
              const rosterIds = new Set<number>();
              weekMatchups.forEach((m: any) => {
                if (m.roster_id) rosterIds.add(m.roster_id);
              });

              if (rosterIds.size > 0) {
                matchups = weekMatchups;
                break;
              }
            }
          }

          if (matchups.length > 0) {
            const userMatchup = matchups.find((m: any) => m.roster_id === userRoster.roster_id);

            if (userMatchup && userMatchup.matchup_id) {
              const opponentMatchups = matchups.filter((m: any) => 
                m.roster_id !== userRoster.roster_id && m.matchup_id === userMatchup.matchup_id
              );

              if (opponentMatchups.length === 1) {
                const opponentRosterId = opponentMatchups[0].roster_id;

                const opponentRoster = rostersResponse.data.find(
                  (r: any) => r.roster_id === opponentRosterId
                );

                if (opponentRoster && opponentRoster.players && opponentRoster.players.length > 0) {
                  const userInfo = await getSleeperUser(opponentRoster.owner_id);
                  const opponentUsername = userInfo?.username || opponentRoster.owner?.display_name || `Owner ${opponentRoster.owner_id}`;

                  const seenOpponentPlayersInLeague = new Set<string>();
                  opponentRoster.players.forEach((playerId: string) => {
                    if (seenOpponentPlayersInLeague.has(playerId)) return;
                    if (!doubleCount && globallyCountedOpponentPlayers.has(playerId)) return;

                    seenOpponentPlayersInLeague.add(playerId);
                    globallyCountedOpponentPlayers.add(playerId);
                    const player = allPlayers[playerId];
                    const nflTeam = player?.team || player?.nfl_team;
                    const position = player?.position || 'N/A';

                    if (excludeDefense && isDefensePosition(position)) {
                      return;
                    }

                    if (player && nflTeam) {
                      opponentTeamCountMap.set(nflTeam, (opponentTeamCountMap.get(nflTeam) || 0) + 1);

                      if (!opponentDetailsMap.has(nflTeam)) {
                        opponentDetailsMap.set(nflTeam, []);
                      }

                      const playerName = player.first_name && player.last_name
                        ? `${player.first_name} ${player.last_name}`
                        : player.full_name || playerId;

                      const leagueName = league.name || `League ${league.league_id}`;
                      const isStarter = opponentRoster.starters?.includes(playerId) || false;

                      opponentDetailsMap.get(nflTeam)!.push({
                        name: playerName,
                        position,
                        league: leagueName,
                        isStarter,
                        isOpponent: true,
                        ownerName: opponentUsername,
                      });
                    }
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing league ${league.league_id}:`, error);
        continue;
      }
    }

    let games: any[] = [];

    if (hasExplicitWeekSelection) {
      // Respect the user's selected week exactly instead of filtering by current date window.
      games = await getWeekGamesFromESPN(season, currentWeek);
    } else {
      const now = Date.now();
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = now - oneWeekMs;
      const fourWeeksFromNow = now + (4 * oneWeekMs);

      for (let i = 0; i < 5; i++) {
        const tryWeek = currentWeek + i;
        const weekGames = await getWeekGamesFromESPN(season, tryWeek);

        const recentGames = weekGames.filter((game: any) => {
          return game.kickoff >= twoWeeksAgo && game.kickoff <= fourWeeksFromNow;
        });

        if (recentGames.length > 0) {
          games = recentGames;
          currentWeek = tryWeek;
          break;
        }
      }
    }

    const gamePlayerCounts: Array<{
      game: any;
      playerCount: number;
      teams: string[];
      starterCount: number;
      benchCount: number;
      opponentCount: number;
      interestScore: number;
      allPlayersInGame: PlayerInfo[];
      topPlayers: string[];
      rankingReason: string;
    }> = [];

    for (const game of games) {
      const userAwayCount = userTeamCountMap.get(game.away_team) || 0;
      const userHomeCount = userTeamCountMap.get(game.home_team) || 0;
      const opponentAwayCount = includeOpponents ? (opponentTeamCountMap.get(game.away_team) || 0) : 0;
      const opponentHomeCount = includeOpponents ? (opponentTeamCountMap.get(game.home_team) || 0) : 0;
      const totalRelevantPlayers = userAwayCount + userHomeCount + opponentAwayCount + opponentHomeCount;

      if (totalRelevantPlayers === 0) {
        continue;
      }

      const teamsWithPlayers: string[] = [];
      if (userAwayCount + opponentAwayCount > 0) teamsWithPlayers.push(game.away_team);
      if (userHomeCount + opponentHomeCount > 0) teamsWithPlayers.push(game.home_team);

      const allPlayersInGame: PlayerInfo[] = [];
      teamsWithPlayers.forEach((team) => {
        const userPlayers = playerDetailsMap.get(team) || [];
        const opponentPlayers = includeOpponents ? (opponentDetailsMap.get(team) || []) : [];
        allPlayersInGame.push(...userPlayers, ...opponentPlayers);
      });

      const relevantPlayers = allPlayersInGame.filter((player) => !onlyStarters || player.isStarter);
      if (relevantPlayers.length === 0) {
        continue;
      }

      const userStarters = relevantPlayers.filter((player) => !player.isOpponent && player.isStarter).length;
      const userBench = relevantPlayers.filter((player) => !player.isOpponent && !player.isStarter).length;
      const opponentStarters = relevantPlayers.filter((player) => player.isOpponent && player.isStarter).length;
      const opponentBench = relevantPlayers.filter((player) => player.isOpponent && !player.isStarter).length;

      const starterCount = userStarters + opponentStarters;
      const benchCount = userBench + opponentBench;
      const opponentCount = opponentStarters + opponentBench;
      const playerCount = starterCount + benchCount;

      const hasPlayersOnBothTeams = teamsWithPlayers.length === 2;
      const interestScore =
        (userStarters * SCORE_WEIGHTS.USER_STARTER) +
        (userBench * SCORE_WEIGHTS.USER_BENCH) +
        (opponentStarters * SCORE_WEIGHTS.OPPONENT_STARTER) +
        (opponentBench * SCORE_WEIGHTS.OPPONENT_BENCH) +
        (hasPlayersOnBothTeams ? SCORE_WEIGHTS.BOTH_TEAMS_HAVE_PLAYERS_BONUS : 0);

      const sortedForHighlights = [...relevantPlayers].sort((a, b) => {
        if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
        if ((a.isOpponent || false) !== (b.isOpponent || false)) return a.isOpponent ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      const topPlayers = sortedForHighlights.slice(0, 3).map((player) => player.name);

      const reasonParts: string[] = [];
      reasonParts.push(`${starterCount} starter${starterCount === 1 ? '' : 's'}`);
      if (!onlyStarters) {
        reasonParts.push(`${benchCount} bench`);
      }
      if (includeOpponents && opponentCount > 0) {
        reasonParts.push(`${opponentCount} opponent`);
      }

      const rankingReason = `${reasonParts.join(' + ')}${topPlayers.length > 0 ? `. Anchored by ${topPlayers.join(', ')}.` : '.'}`;

      gamePlayerCounts.push({
        game,
        playerCount,
        teams: teamsWithPlayers,
        starterCount,
        benchCount,
        opponentCount,
        interestScore,
        allPlayersInGame,
        topPlayers,
        rankingReason,
      });
    }

    gamePlayerCounts.sort((a, b) => {
      if (b.interestScore !== a.interestScore) {
        return b.interestScore - a.interestScore;
      }
      if (b.starterCount !== a.starterCount) {
        return b.starterCount - a.starterCount;
      }
      if (b.playerCount !== a.playerCount) {
        return b.playerCount - a.playerCount;
      }
      return (a.game.kickoff || 0) - (b.game.kickoff || 0);
    });

    const recommendations: GameRecommendation[] = [];
    const maxGamesToRecommend = Math.min(numberOfGames, gamePlayerCounts.length);

    for (let i = 0; i < maxGamesToRecommend; i++) {
      const {
        game,
        playerCount,
        allPlayersInGame,
        interestScore,
        starterCount,
        benchCount,
        opponentCount,
        rankingReason,
        topPlayers,
      } = gamePlayerCounts[i];

      recommendations.push({
        game,
        playerCount,
        players: allPlayersInGame,
        interestScore,
        starterCount,
        benchCount,
        opponentCount,
        rankingReason,
        topPlayers,
      });
    }

    if (recommendations.length === 0) {
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
