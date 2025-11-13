# What NFL Game Should I Watch?

A React application that helps you decide which NFL game to watch by analyzing your Sleeper fantasy football teams and recommending the game with the most of your players.

## Features

- **Sleeper Integration**: Connect with your Sleeper account
- **Multi-League Support**: Analyzes all your fantasy football leagues
- **Smart Recommendation**: Shows which NFL game has the most of your players
- **Player Details**: Lists all your players in the recommended game
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/CharlesAndre-Martineau/WhatNflGameShouldIWatch.git
cd WhatNflGameShouldIWatch
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The app will open in your browser at `http://localhost:3000`

### Building

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## How It Works

1. Enter your Sleeper username
2. The app fetches all your fantasy football leagues and rosters
3. It analyzes all players across your teams
4. It matches players to their NFL teams
5. It identifies which NFL game has the most of your players
6. It displays the game matchup, kickoff time, and your players involved

## Architecture

### `/src/services`
- `sleeperApi.ts` - Core API calls to Sleeper API
- `gameRecommendation.ts` - Business logic for game analysis and recommendation

### `/src/components`
- `GameRecommender.tsx` - Main UI component

### `/src/styles`
- `GameRecommender.css` - Styling for the application

## API Integration

This app uses the public Sleeper API:
- [Sleeper API Documentation](https://docs.sleeper.app/)

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Axios** - HTTP client
- **CSS3** - Styling with gradients and animations

## Future Enhancements

- [ ] Show multiple game recommendations
- [ ] Historical player performance in games
- [ ] League-specific filtering
- [ ] Player injury information
- [ ] Game spread and over/under odds
- [ ] Save preferences to local storage

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
