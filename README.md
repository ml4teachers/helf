# HELF - Your personal companion for better helf.

HELF is a modern web application built for strength athletes to track their training progress, manage workout sessions, and get AI-powered training recommendations.

## Features

- **Training Session Management**: Create, track, and analyze your workout sessions
- **Exercise Library**: Access a comprehensive database of powerlifting and strength exercises
- **Progress Tracking**: Monitor your performance over time with detailed metrics
- **AI-Powered Assistant**: Get personalized training recommendations and form tips
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **UI Components**: shadcn/ui with Radix UI
- **Backend**: Supabase (PostgreSQL database, Authentication, Storage)
- **AI Integration**: OpenAI API for training recommendations
- **State Management**: React Context API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- pnpm package manager
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/helf.git
   cd helf
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   Create a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Run the development server
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Database Setup

The application requires a Supabase database. The schema is defined in `schema.sql`. You can run this SQL script in your Supabase project's SQL editor to set up the required tables.

## Project Structure

```
/
├── public/                 # Static assets
├── src/                    
│   ├── app/                # Next.js App Router (pages and API routes)
│   │   ├── api/            # API endpoints
│   │   ├── auth/           # Authentication pages
│   │   └── dashboard/      # User dashboard and features
│   ├── components/         # Reusable UI components
│   │   ├── assistant/      # AI assistant components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # shadcn/ui components
│   └── lib/                # Utilities and services
│       ├── prompts/        # AI assistant prompts
│       └── trainingModulesNew/ # Training data management
├── .env.local              # Environment variables (not in repo)
└── package.json            # Project dependencies
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - UI component system
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [OpenAI](https://openai.com/) - AI models and API

This is a vibe coding project made with [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code)