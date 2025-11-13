# ESPN API Integration for NFL Schedule

## Overview
The app now uses the **ESPN Sports Core API** to fetch accurate NFL game schedules with real-time data.

## API Flow

### 1. Get Current Week
```
GET /state/nfl (Sleeper API)
Returns: current season and week number
```

### 2. Get Week Games (ESPN)
```
GET /v2/sports/football/leagues/nfl/seasons/{season}/types/2/weeks/{week}/events
Returns: List of event $ref URLs for that week
```

### 3. Get Game Details (ESPN)
For each event, fetch:
```
GET /v2/sports/football/leagues/nfl/events/{gameId}
Returns: Complete game info including:
- Away team abbreviation
- Home team abbreviation
- Kickoff date/time
- Game status
- Venue information
```

## Data Structure

Each game object returned contains:
```typescript
{
  week: number;
  season: number;
  away_team: string;        // e.g., "NYJ"
  home_team: string;        // e.g., "NE"
  kickoff: number;          // Unix timestamp in milliseconds
  status: string;           // "scheduled", "in_progress", etc.
  name: string;             // Full game name, e.g., "New York Jets at New England Patriots"
}
```

## Key Implementation Details

### Why ESPN API?
- **Real-time updates**: Games are updated live as they progress
- **Rich data**: Includes venue, weather, status, and more
- **Reliability**: ESPN is a major sports data provider
- **No authentication**: Public API endpoints

### Sleeper API Integration
- Uses Sleeper for fantasy team data (rosters, players)
- Uses Sleeper for current NFL week/season
- Uses ESPN for actual game schedule details

### Performance Optimizations
- **Player data caching**: 5MB player database cached for 1 hour
- **Parallel requests**: Uses `Promise.all()` to fetch multiple games simultaneously
- **Smart filtering**: Only processes rosters that belong to the user

## Flow Diagram

```
User enters username
    ↓
Get User ID from Sleeper ✓
    ↓
Get Current Season/Week from Sleeper ✓
    ↓
Get All User Leagues from Sleeper ✓
    ↓
For each league:
  - Get rosters
  - Find user's roster
  - Get players ✓
    ↓
Count players by NFL team ✓
    ↓
Find team with most players ✓
    ↓
Fetch Week Games from ESPN ✓
    ↓
Find matching game ✓
    ↓
Display recommendation
```

## Error Handling
- Try/catch blocks on all API calls
- Graceful fallbacks if ESPN API is down
- Detailed console logging for debugging
- User-friendly error messages in UI

## Testing Tips

1. **Valid Sleeper usernames** to test:
   - Use your own Sleeper username if you have one
   - The API will return "User not found" for invalid usernames

2. **Checking the flow**:
   - Open browser DevTools (F12)
   - Console tab shows debug logs
   - Network tab shows all API calls

3. **Example game data** from ESPN API includes:
   - Team abbreviations: NYJ, NE, KC, etc.
   - Kickoff times in ISO format
   - Game statuses: scheduled, in_progress, final
   - Venue information with weather

## Future Enhancements

- [ ] Add team logos
- [ ] Show game spread and over/under odds
- [ ] Add player injury information
- [ ] Historical player performance in games
- [ ] Multi-week view
- [ ] Playoff bracket information
