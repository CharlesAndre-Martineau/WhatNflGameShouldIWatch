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
  const [selectedGame, setSelectedGame] = useState<GameRecommendation | null>(null);

  useEffect(() => {
    const fetchCurrentWeek = async () => {
      const params = new URLSearchParams(window.location.search);
      const usernameFromUrl = params.get('username');
      const leagueFromUrl = params.get('league');
      const weekFromUrl = Number(params.get('week'));
      const doubleCountFromUrl = params.get('doubleCount');
      const excludeDefenseFromUrl = params.get('excludeDefense');

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

      const params = new URLSearchParams(window.location.search);
      params.set('username', trimmedUsername);
      params.set('week', String(selectedWeek ?? 1));
      params.set('league', leagueFilter);
      params.set('doubleCount', doubleCount ? '1' : '0');
      params.set('excludeDefense', excludeDefense ? '1' : '0');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      setUsername(trimmedUsername);

      if (!gameRecommendations || gameRecommendations.length === 0) {
        setError(
          'No games found with your players this week. Check your league settings.'
        );
      } else {
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
    myStarterCount: recommendation.players.filter((player) => !player.isOpponent && player.isStarter).length,
    myBenchCount: recommendation.players.filter((player) => !player.isOpponent && !player.isStarter).length,
    theirStarterCount: recommendation.players.filter((player) => player.isOpponent && player.isStarter).length,
    theirBenchCount: recommendation.players.filter((player) => player.isOpponent && !player.isStarter).length,
    recommendation,
    rank: idx + 1,
    matchup: `${recommendation.game.away_team} @ ${recommendation.game.home_team}`,
  }));

  const sortedTableRows = [...tableRows].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case 'rank':
        comparison = a.rank - b.rank;
        break;
      case 'matchup':
        comparison = a.matchup.localeCompare(b.matchup);
        break;
      case 'interestScore':
        comparison = a.recommendation.interestScore - b.recommendation.interestScore;
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
        comparison = (a.recommendation.game.kickoff || 0) - (b.recommendation.game.kickoff || 0);
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
                <button type="button" className="back-button" onClick={() => setSelectedGame(null)}>
                  Back to games
                </button>
                <h2 className="detail-title">
                  {selectedGame.game.away_team} @ {selectedGame.game.home_team}
                </h2>
                <p className="detail-subtitle">Kickoff: {formatTime(selectedGame.game.kickoff)}</p>
                <div className="detail-grid">
                  <section className="detail-card">
                    <h3>Your players ({selectedGameUserPlayers.length})</h3>
                    <ul>
                      {selectedGameUserPlayers.map((player, idx) => (
                        <li key={`you-${idx}`}>
                          <span>{player.name} ({player.position})</span>
                          <span>{player.isStarter ? 'Starter' : 'Bench'} • {player.league}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="detail-card">
                    <h3>Opponent players ({selectedGameOpponentPlayers.length})</h3>
                    <ul>
                      {selectedGameOpponentPlayers.map((player, idx) => (
                        <li key={`opp-${idx}`}>
                          <span>{player.name} ({player.position})</span>
                          <span>{player.isStarter ? 'Starter' : 'Bench'} • {player.ownerName || 'Opponent'} • {player.league}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="recommendation-table">
                  <thead>
                    <tr>
                      <th><button type="button" onClick={() => handleSort('rank')}>Rank</button></th>
                      <th><button type="button" onClick={() => handleSort('matchup')}>Matchup</button></th>
                      <th><button type="button" onClick={() => handleSort('interestScore')}>Score</button></th>
                      <th><button type="button" onClick={() => handleSort('myStarterCount')}>Starters</button></th>
                      <th><button type="button" onClick={() => handleSort('myBenchCount')}>Bench</button></th>
                      <th><button type="button" onClick={() => handleSort('theirStarterCount')}>Opp. Starters</button></th>
                      <th><button type="button" onClick={() => handleSort('theirBenchCount')}>Opp. Bench</button></th>
                      <th><button type="button" onClick={() => handleSort('kickoff')}>Kickoff</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableRows.map(({ recommendation, rank, matchup, myStarterCount, myBenchCount, theirStarterCount, theirBenchCount }) => (
                      <tr
                        key={`${matchup}-${rank}`}
                        className="clickable-row"
                        onClick={() => setSelectedGame(recommendation)}
                      >
                        <td>#{rank}</td>
                        <td className="matchup-cell">{matchup}</td>
                        <td>{recommendation.interestScore.toFixed(2)}</td>
                        <td>{myStarterCount}</td>
                        <td>{myBenchCount}</td>
                        <td>{theirStarterCount}</td>
                        <td>{theirBenchCount}</td>
                        <td>{formatTime(recommendation.game.kickoff)}</td>
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
