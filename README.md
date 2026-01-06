# Anchor App

Transform intentions into powerful visual symbols using AI.

## Project Overview

Anchor is a premium mobile app that helps users clarify intentions and achieve goals through visual symbols (sigils) combined with daily activation rituals.

- **Frontend**: React Native + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15+ with Prisma ORM
- **AI**: Stable Diffusion XL (via Replicate API)

## Project Structure

```
anchor-app/
├── frontend/          # React Native mobile app
│   ├── src/
│   │   ├── screens/   # Full-screen views
│   │   ├── components/ # Reusable UI components
│   │   ├── services/  # API clients, business logic
│   │   ├── utils/     # Pure functions, algorithms
│   │   ├── theme/     # Design system (colors, typography, spacing)
│   │   └── types/     # TypeScript types
│   └── package.json
│
├── backend/           # Node.js API server
│   ├── src/
│   │   ├── api/       # Express routes
│   │   ├── services/  # Business logic
│   │   └── models/    # Prisma models
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
└── docs/              # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- npm (not yarn or pnpm)

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

### Backend Setup

```bash
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Visit `http://localhost:3000/health` to verify the server is running.

## Development Phases

- ✅ **Phase 0**: Project Setup (Current)
- 🔜 **Phase 1**: MVP Core Features (Weeks 2-4)
- 🔜 **Phase 2**: AI Enhancement (Weeks 5-6)
- 🔜 **Phase 3**: Advanced Features (Weeks 7-9)
- 🔜 **Phase 4**: Monetization & Polish (Weeks 10-12)

## Design System

All colors, spacing, and typography values are defined in `frontend/src/theme/`.

**Never use arbitrary values** - always use the design system constants.

## Code Standards

- TypeScript strict mode enabled
- ESLint + Prettier for code quality
- Comprehensive testing with Jest
- No `console.log` in production code
- Error handling on all async operations

## Documentation

See `docs/` folder for comprehensive technical documentation.

## License

UNLICENSED - Private project
