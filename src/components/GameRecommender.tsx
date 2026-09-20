import React, { useState, useEffect } from 'react';
import '../styles/GameRecommender.css';
import { getRecommendedGames, getUserFantasyTeams } from '../services/gameRecommendation';
import { GameRecommendation } from '../services/sleeperApi';
import { getNFLState } from '../services/gameRecommendation';

type SortColumn = 'rank' | 'matchup' | 'interestScore' | 'myStarterCount' | 'myBenchCount' | 'theirStarterCount' | 'theirBenchCount' | 'kickoff';

export const GameRecommender: React.FC = () => {
  const MAX_GAMES_TO_SHOW = 32;
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<GameRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const [dotCount, setDotCount] = useState(0);
  const [sortColumn, setSortColumn] = useState<SortColumn>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hasTriedAutoLoad, setHasTriedAutoLoad] = useState(false);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [doubleCount, setDoubleCount] = useState(true);
  const [excludeDefense, setExcludeDefense] = useState(false);
  const [groupByKickoff, setGroupByKickoff] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameRecommendation | null>(null);
  const [requestedGameId, setRequestedGameId] = useState<string | null>(null);

  const getGameId = (recommendation: GameRecommendation): string => (
    `${recommendation.game.away_team}-${recommendation.game.home_team}-${recommendation.game.kickoff || 0}`
  );

  const updateUrlParams = (usernameValue: string, gameId?: string | null) => {
    const params = new URLSearchParams(window.location.search);
    params.set('username', usernameValue);
    params.set('week', String(selectedWeek ?? 1));
    params.set('league', leagueFilter);
    params.set('doubleCount', doubleCount ? '1' : '0');
    params.set('excludeDefense', excludeDefense ? '1' : '0');
    params.set('groupByKickoff', groupByKickoff ? '1' : '0');

    if (gameId) {
      params.set('game', gameId);
    } else {
      params.delete('game');
    }

    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const fetchCurrentWeek = async () => {
      const params = new URLSearchParams(window.location.search);
      const usernameFromUrl = params.get('username');
      const leagueFromUrl = params.get('league');
      const weekFromUrl = Number(params.get('week'));
      const doubleCountFromUrl = params.get('doubleCount');
      const excludeDefenseFromUrl = params.get('excludeDefense');
      const groupByKickoffFromUrl = params.get('groupByKickoff');
      const gameFromUrl = params.get('game');

      if (usernameFromUrl) {
        setUsername(usernameFromUrl);
      }
      if (leagueFromUrl) {
        setLeagueFilter(leagueFromUrl);
      }
      if (doubleCountFromUrl === '0') {
        setDoubleCount(false);
      }
      if (excludeDefenseFromUrl === '1') {
        setExcludeDefense(true);
      }
      if (groupByKickoffFromUrl === '1') {
        setGroupByKickoff(true);
      }
      if (gameFromUrl) {
        setRequestedGameId(gameFromUrl);
      }

      try {
        const nflState = await getNFLState();
        if (!Number.isNaN(weekFromUrl) && weekFromUrl >= 1 && weekFromUrl <= 18) {
          setSelectedWeek(weekFromUrl);
        } else {
          setSelectedWeek(nflState.week);
        }
      } catch (err) {
        console.error('Error fetching current week:', err);
        setSelectedWeek((!Number.isNaN(weekFromUrl) && weekFromUrl >= 1 && weekFromUrl <= 18) ? weekFromUrl : 1);
      }
    };
    fetchCurrentWeek();
  }, []);

  useEffect(() => {
    if (!loading) {
      setDotCount(0);
      return;
    }

    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [loading]);

  const loadRecommendations = async (rawUsername: string) => {
    const trimmedUsername = rawUsername.trim();

    if (!trimmedUsername) {
      setError('Please enter a Sleeper username');
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);
    setSelectedGame(null);

    try {
      const userResponse = await fetch(
        `https://api.sleeper.app/v1/user/${trimmedUsername}`
      );
      
      if (!userResponse.ok) {
        throw new Error('User not found. Please check your Sleeper username.');
      }

      const userData = await userResponse.json();
      const nflState = await getNFLState();
      const userLeagues = await getUserFantasyTeams(userData.user_id, nflState.season);
      const leagueNames = userLeagues
        .map((league) => league.name)
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b));
      setAvailableLeagues(Array.from(new Set(leagueNames)));

      const selectedLeague = leagueFilter === 'all' ? undefined : leagueFilter;
      const gameRecommendations = await getRecommendedGames(
        userData.user_id,
        MAX_GAMES_TO_SHOW,
        false,
        true,
        selectedWeek,
        selectedLeague,
        doubleCount,
        excludeDefense
      );
      setUsername(trimmedUsername);

      if (!gameRecommendations || gameRecommendations.length === 0) {
        updateUrlParams(trimmedUsername, null);
        setError(
          'No games found with your players this week. Check your league settings.'
        );
      } else {
        if (requestedGameId) {
          const requestedGame = gameRecommendations.find((recommendation) => getGameId(recommendation) === requestedGameId) || null;
          setSelectedGame(requestedGame);
          setRequestedGameId(requestedGame ? getGameId(requestedGame) : null);
          updateUrlParams(trimmedUsername, requestedGame ? getGameId(requestedGame) : null);
        } else {
          updateUrlParams(trimmedUsername, null);
        }
        setRecommendations(gameRecommendations);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasTriedAutoLoad || selectedWeek === undefined) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const usernameFromUrl = params.get('username');
    setHasTriedAutoLoad(true);

    if (usernameFromUrl) {
      void loadRecommendations(usernameFromUrl);
    }
  }, [hasTriedAutoLoad, selectedWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadRecommendations(username);
  };

  const formatTime = (kickoff?: number) => {
    try {
      if (!kickoff) return 'TBD';
      // kickoff is already in milliseconds from getTime()
      const date = new Date(kickoff);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return 'TBD';
    }
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection(column === 'matchup' || column === 'kickoff' ? 'asc' : 'desc');
  };

  const tableRows = recommendations.map((recommendation, idx) => ({
    key: `${recommendation.game.away_team}-${recommendation.game.home_team}-${recommendation.game.kickoff || 0}-${idx}`,
    myStarterCount: recommendation.players.filter((player) => !player.isOpponent && player.isStarter).length,
    myBenchCount: recommendation.players.filter((player) => !player.isOpponent && !player.isStarter).length,
    theirStarterCount: recommendation.players.filter((player) => player.isOpponent && player.isStarter).length,
    theirBenchCount: recommendation.players.filter((player) => player.isOpponent && !player.isStarter).length,
    interestScore: recommendation.interestScore,
    kickoff: recommendation.game.kickoff || 0,
    recommendation,
    rank: idx + 1,
    matchup: `${recommendation.game.away_team} @ ${recommendation.game.home_team}`,
    gamesCount: 1,
    matchups: [`${recommendation.game.away_team} @ ${recommendation.game.home_team}`],
  }));

  const groupedRows = Object.values(
    tableRows.reduce((acc, row) => {
      const kickoffKey = String(row.kickoff || 0);

      if (!acc[kickoffKey]) {
        acc[kickoffKey] = {
          key: `kickoff-${kickoffKey}`,
          rank: row.rank,
          matchup: row.gamesCount === 1 ? row.matchup : `${row.gamesCount} games`,
          myStarterCount: 0,
          myBenchCount: 0,
          theirStarterCount: 0,
          theirBenchCount: 0,
          interestScore: 0,
          kickoff: row.kickoff,
          gamesCount: 0,
          matchups: [] as string[],
          recommendation: row.recommendation,
        };
      }

      acc[kickoffKey].myStarterCount += row.myStarterCount;
      acc[kickoffKey].myBenchCount += row.myBenchCount;
      acc[kickoffKey].theirStarterCount += row.theirStarterCount;
      acc[kickoffKey].theirBenchCount += row.theirBenchCount;
      acc[kickoffKey].interestScore += row.interestScore;
      acc[kickoffKey].gamesCount += 1;
      acc[kickoffKey].matchups.push(row.matchup);
      if (row.rank < acc[kickoffKey].rank) {
        acc[kickoffKey].rank = row.rank;
        acc[kickoffKey].recommendation = row.recommendation;
      }

      return acc;
    }, {} as Record<string, {
      key: string;
      rank: number;
      matchup: string;
      myStarterCount: number;
      myBenchCount: number;
      theirStarterCount: number;
      theirBenchCount: number;
      interestScore: number;
      kickoff: number;
      gamesCount: number;
      matchups: string[];
      recommendation: GameRecommendation;
    }>)
  ).map((group) => ({
    ...group,
    matchup: group.gamesCount === 1 ? group.matchups[0] : `${group.gamesCount} games`,
  }));

  const displayRows = groupByKickoff ? groupedRows : tableRows;

  const dynamicRankByKey = new Map(
    [...displayRows]
      .sort((a, b) => {
        if (b.interestScore !== a.interestScore) {
          return b.interestScore - a.interestScore;
        }
        return (a.kickoff || 0) - (b.kickoff || 0);
      })
      .map((row, idx) => [row.key, idx + 1])
  );

  const sortedTableRows = [...displayRows].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case 'rank':
        comparison = (dynamicRankByKey.get(a.key) || 0) - (dynamicRankByKey.get(b.key) || 0);
        break;
      case 'matchup':
        if (groupByKickoff) {
          comparison = (a.kickoff || 0) - (b.kickoff || 0);
        } else {
          comparison = a.matchup.localeCompare(b.matchup);
        }
        break;
      case 'interestScore':
        comparison = a.interestScore - b.interestScore;
        break;
      case 'myStarterCount':
        comparison = a.myStarterCount - b.myStarterCount;
        break;
      case 'myBenchCount':
        comparison = a.myBenchCount - b.myBenchCount;
        break;
      case 'theirStarterCount':
        comparison = a.theirStarterCount - b.theirStarterCount;
        break;
      case 'theirBenchCount':
        comparison = a.theirBenchCount - b.theirBenchCount;
        break;
      case 'kickoff':
        comparison = (a.kickoff || 0) - (b.kickoff || 0);
        break;
      default:
        comparison = 0;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const selectedGameUserPlayers = selectedGame
    ? selectedGame.players
        .filter((player) => !player.isOpponent)
        .sort((a, b) => {
          if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
    : [];

  const selectedGameOpponentPlayers = selectedGame
    ? selectedGame.players
        .filter((player) => player.isOpponent)
        .sort((a, b) => {
          if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
    : [];

  const selectedGameUserStarters = selectedGameUserPlayers.filter((player) => player.isStarter);
  const selectedGameUserBench = selectedGameUserPlayers.filter((player) => !player.isStarter);
  const selectedGameOpponentStarters = selectedGameOpponentPlayers.filter((player) => player.isStarter);
  const selectedGameOpponentBench = selectedGameOpponentPlayers.filter((player) => !player.isStarter);

  const openGameDetails = (recommendation: GameRecommendation) => {
    const gameId = getGameId(recommendation);
    setSelectedGame(recommendation);
    setRequestedGameId(gameId);
    updateUrlParams(username, gameId);
  };

  const closeGameDetails = () => {
    setSelectedGame(null);
    setRequestedGameId(null);
    updateUrlParams(username, null);
  };

  return (
    <div className="game-recommender">
      <div className="container">
        <h1>What NFL Game Should I Watch? 🏈</h1>
        <p className="subtitle">
          Table view with starters, bench, and opponent impact included by default
        </p>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="form-group">
            <div className="search-row">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your Sleeper username"
                className="input-field"
                disabled={loading}
              />
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? `Finding Games${'.'.repeat(dotCount)}` : 'Find My Games'}
              </button>
            </div>
            <div className="form-controls">
              <div className="week-selector">
                <label htmlFor="week-select" className="selector-label">Week</label>
                <select
                  id="week-select"
                  value={selectedWeek ?? 1}
                  onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                  className="selector-input"
                  disabled={loading}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((week) => (
                    <option key={week} value={week}>Week {week}</option>
                  ))}
                </select>
              </div>
              <div className="week-selector">
                <label htmlFor="league-select" className="selector-label">League</label>
                <select
                  id="league-select"
                  value={leagueFilter}
                  onChange={(e) => setLeagueFilter(e.target.value)}
                  className="selector-input"
                  disabled={loading}
                >
                  <option value="all">All leagues</option>
                  {availableLeagues.map((leagueName) => (
                    <option key={leagueName} value={leagueName}>{leagueName}</option>
                  ))}
                </select>
              </div>
              <label className="double-count-toggle">
                <input
                  type="checkbox"
                  checked={doubleCount}
                  onChange={(e) => setDoubleCount(e.target.checked)}
                  disabled={loading}
                />
                Double count duplicate players
              </label>
              <label className="double-count-toggle">
                <input
                  type="checkbox"
                  checked={excludeDefense}
                  onChange={(e) => setExcludeDefense(e.target.checked)}
                  disabled={loading}
                />
                Exclude DEF
              </label>
              <label className="double-count-toggle">
                <input
                  type="checkbox"
                  checked={groupByKickoff}
                  onChange={(e) => setGroupByKickoff(e.target.checked)}
                  disabled={loading}
                />
                Group by kickoff time
              </label>
            </div>
          </div>
        </form>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <div className="recommendations-container">
            <div className="results-meta">
              Showing {recommendations.length} game{recommendations.length === 1 ? '' : 's'}
            </div>
            {selectedGame ? (
              <div className="detail-view">
                <button type="button" className="back-button" onClick={closeGameDetails}>
                  Back to games
                </button>
                <h2 className="detail-title">
                  {selectedGame.game.away_team} @ {selectedGame.game.home_team}
                </h2>
                <p className="detail-subtitle">Kickoff: {formatTime(selectedGame.game.kickoff)}</p>
                <div className="detail-grid">
                  <section className="detail-card">
                    <h3>Your players ({selectedGameUserPlayers.length})</h3>
                    <div className="detail-section detail-starters">
                      <h4>Starters ({selectedGameUserStarters.length})</h4>
                      <ul>
                        {selectedGameUserStarters.map((player, idx) => (
                          <li key={`you-starter-${idx}`}>
                            <span>{player.name} ({player.position})</span>
                            <span><strong className="player-tag starter-tag">Starter</strong> • {player.league}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="detail-section detail-bench">
                      <h4>Bench ({selectedGameUserBench.length})</h4>
                      <ul>
                        {selectedGameUserBench.map((player, idx) => (
                          <li key={`you-bench-${idx}`}>
                            <span>{player.name} ({player.position})</span>
                            <span><strong className="player-tag bench-tag">Bench</strong> • {player.league}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                  <section className="detail-card">
                    <h3>Opponent players ({selectedGameOpponentPlayers.length})</h3>
                    <div className="detail-section detail-starters">
                      <h4>Starters ({selectedGameOpponentStarters.length})</h4>
                      <ul>
                        {selectedGameOpponentStarters.map((player, idx) => (
                          <li key={`opp-starter-${idx}`}>
                            <span>{player.name} ({player.position})</span>
                            <span><strong className="player-tag starter-tag">Starter</strong> • {player.ownerName || 'Opponent'} • {player.league}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="detail-section detail-bench">
                      <h4>Bench ({selectedGameOpponentBench.length})</h4>
                      <ul>
                        {selectedGameOpponentBench.map((player, idx) => (
                          <li key={`opp-bench-${idx}`}>
                            <span>{player.name} ({player.position})</span>
                            <span><strong className="player-tag bench-tag">Bench</strong> • {player.ownerName || 'Opponent'} • {player.league}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="recommendation-table">
                  <thead>
                    <tr>
                      <th><button type="button" onClick={() => handleSort('rank')}>Rank</button></th>
                      <th><button type="button" onClick={() => handleSort('matchup')}>{groupByKickoff ? 'Games' : 'Matchup'}</button></th>
                      <th><button type="button" onClick={() => handleSort('interestScore')}>Score</button></th>
                      <th><button type="button" onClick={() => handleSort('myStarterCount')}>Starters</button></th>
                      <th><button type="button" onClick={() => handleSort('myBenchCount')}>Bench</button></th>
                      <th><button type="button" onClick={() => handleSort('theirStarterCount')}>Opp. Starters</button></th>
                      <th><button type="button" onClick={() => handleSort('theirBenchCount')}>Opp. Bench</button></th>
                      <th><button type="button" onClick={() => handleSort('kickoff')}>Kickoff</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableRows.map(({ key, recommendation, matchup, myStarterCount, myBenchCount, theirStarterCount, theirBenchCount, interestScore, kickoff, gamesCount, matchups }) => (
                      <tr
                        key={key}
                        className={!groupByKickoff || gamesCount === 1 ? 'clickable-row' : ''}
                        onDoubleClick={!groupByKickoff || gamesCount === 1 ? () => openGameDetails(recommendation) : undefined}
                      >
                        <td>#{dynamicRankByKey.get(key) || '-'}</td>
                        <td className={`matchup-cell ${groupByKickoff ? 'grouped-matchup-cell' : ''}`}>
                          <div>{matchup}</div>
                          {groupByKickoff && gamesCount > 1 && (
                            <div className="grouped-matchup-subtitle">
                              {matchups.join(' • ')}
                            </div>
                          )}
                        </td>
                        <td>{interestScore.toFixed(2)}</td>
                        <td>{myStarterCount}</td>
                        <td>{myBenchCount}</td>
                        <td>{theirStarterCount}</td>
                        <td>{theirBenchCount}</td>
                        <td>{formatTime(kickoff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
