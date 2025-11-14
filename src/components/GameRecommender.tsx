import React, { useState } from 'react';
import '../styles/GameRecommender.css';
import { getRecommendedGames } from '../services/gameRecommendation';
import { GameRecommendation } from '../services/sleeperApi';

export const GameRecommender: React.FC = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<GameRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onlyStarters, setOnlyStarters] = useState(true);
  const [numberOfGames, setNumberOfGames] = useState(1);
  const [includeOpponents, setIncludeOpponents] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      if (!username.trim()) {
        setError('Please enter a Sleeper username');
        setLoading(false);
        return;
      }

      // First, get the user ID from username
      const userResponse = await fetch(
        `https://api.sleeper.app/v1/user/${username}`
      );
      
      if (!userResponse.ok) {
        throw new Error('User not found. Please check your Sleeper username.');
      }

      const userData = await userResponse.json();
      const gameRecommendations = await getRecommendedGames(userData.user_id, numberOfGames, onlyStarters, includeOpponents);

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

  return (
    <div className="game-recommender">
      <div className="container">
        <h1>What NFL Game Should I Watch? 🏈</h1>
        <p className="subtitle">
          Connect your Sleeper account to find which game has your most players
        </p>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="form-group">
            <div className="starters-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={onlyStarters}
                  onChange={(e) => setOnlyStarters(e.target.checked)}
                  className="toggle-checkbox"
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Only count starters</span>
              </label>
            </div>
            <div className="opponents-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={includeOpponents}
                  onChange={(e) => setIncludeOpponents(e.target.checked)}
                  className="toggle-checkbox"
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Include opponent players</span>
              </label>
            </div>
            <div className="number-selector">
              <label htmlFor="num-games" className="selector-label">How many games?</label>
              <select
                id="num-games"
                value={numberOfGames}
                onChange={(e) => setNumberOfGames(parseInt(e.target.value))}
                className="selector-input"
                disabled={loading}
              >
                <option value={1}>1 Game</option>
                <option value={2}>2 Games</option>
                <option value={3}>3 Games</option>
                <option value={4}>4 Games</option>
                <option value={5}>5 Games</option>
              </select>
            </div>
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
              {loading ? 'Finding Games...' : 'Find My Games'}
            </button>
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
            {recommendations.map((recommendation, gameIdx) => (
              <div key={gameIdx} className="recommendation-card">
                <div className="game-header">
                  <h2 className="game-matchup">
                    {recommendation.game.away_team} @ {recommendation.game.home_team}
                  </h2>
                  <p className="game-time">
                    Kickoff: {formatTime(recommendation.game.kickoff)}
                  </p>
                </div>

                <div className="player-info">
                  <div className="player-count">
                    <span className="count-number">
                      {onlyStarters 
                        ? recommendation.players.filter((p) => p.isStarter).length 
                        : recommendation.playerCount}
                    </span>
                    <span className="count-label">
                      Player{(onlyStarters ? recommendation.players.filter((p) => p.isStarter).length : recommendation.playerCount) !== 1 ? 's' : ''} Playing
                    </span>
                  </div>

                  <div className="player-list">
                    <h3>Your Players in This Game:</h3>
                    <ul>
                      {recommendation.players
                        .filter((p) => !onlyStarters || p.isStarter)
                        .map((player, idx) => (
                        <li key={idx} className={player.isOpponent ? 'opponent' : (player.isStarter ? 'starter' : 'bench')}>
                          <div className="player-info-row">
                            <span className="player-name">{player.name}</span>
                            <span className="player-position">{player.position}</span>
                          </div>
                          <div className="player-league">
                            {player.league}
                            {player.isOpponent && <span className="opponent-label"> ({player.ownerName})</span>}
                            {!player.isStarter && !player.isOpponent && <span className="bench-label"> (Bench)</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="recommendation-reason">
                  <p>
                    This game has many players from your fantasy teams!
                    Watch to see your squad perform.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
