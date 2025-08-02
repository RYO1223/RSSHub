# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RSSHub is the world's largest RSS network, delivering millions of contents aggregated from all kinds of sources. It's built with Node.js and TypeScript, using the Hono.js framework.

## Essential Commands

### Development
```bash
# Install dependencies
pnpm i

# Start development server with hot reload
pnpm run dev

# Start development server with production caching
pnpm run dev:cache

# Run specific route in development
cross-env NODE_ENV=dev tsx lib/index.ts
```

### Testing
```bash
# Run all tests with coverage
pnpm test

# Run tests in watch mode
pnpm run vitest:watch

# Run specific test file
pnpm vitest path/to/test.ts

# Run only route tests
pnpm vitest routes

# Full route testing (WARNING: runs ALL routes, very slow)
pnpm run vitest:fullroutes
```

### Code Quality
```bash
# Format and lint all files
pnpm run format

# Check formatting and linting without fixing
pnpm run format:check

# Lint only
pnpm run lint
```

### Building
```bash
# Build for production
pnpm run build

# Build documentation
pnpm run build:docs

# Start production server (after building)
pnpm start
```

## Architecture Overview

### Route System
RSSHub uses a namespace-based route system. Each route is a module under `lib/routes/`:

```
lib/routes/
├── [namespace]/
│   ├── namespace.ts    # Namespace metadata and configuration
│   ├── [route].ts      # Individual route implementation
│   └── utils.ts        # Shared utilities for the namespace
```

Each route exports a `Route` object with:
- `path`: URL pattern with parameters (e.g., `/user/:id`)
- `handler`: Async function that returns RSS data
- `categories`: Content categorization
- `features`: Capabilities (requirePuppeteer, antiCrawler, etc.)
- `radar`: Auto-discovery rules for browser extensions

### Core Components

1. **Entry Points**:
   - `lib/index.ts`: Server startup with clustering
   - `lib/app-bootstrap.tsx`: Application setup and middleware chain
   - `lib/pkg.ts`: Package export for programmatic use

2. **Middleware Stack** (in order):
   - URL normalization
   - Compression
   - Logging and tracing
   - Error monitoring (Sentry)
   - Access control and authentication
   - Template rendering
   - Anti-hotlinking
   - Parameter validation
   - Caching

3. **Configuration** (`lib/config.ts`):
   - Environment-based configuration
   - Route-specific settings
   - Proxy and cache configurations
   - Service credentials

### Development Workflow

1. **Adding a New Route**:
   - Create namespace directory if needed: `lib/routes/[namespace]/`
   - Add `namespace.ts` with metadata
   - Implement route in `[route-name].ts`
   - Follow existing patterns for consistency

2. **Route Handler Pattern**:
   ```typescript
   async function handler(ctx) {
       const { id } = ctx.req.param();
       // Fetch and process data
       const items = await fetchData(id);
       
       return {
           title: 'Feed Title',
           link: 'https://example.com',
           item: items.map(item => ({
               title: item.title,
               link: item.url,
               description: item.content,
               pubDate: item.date,
           })),
       };
   }
   ```

3. **Testing Routes**:
   - Routes are automatically discovered and tested
   - Add route-specific tests if needed
   - Use mock data for external API calls

### Key Utilities

- **HTTP Requests**: Use `ofetch` from `@/utils/request`
- **HTML Parsing**: Use `cheerio` from `@/utils/cheerio`
- **Date Handling**: Use `dayjs` with timezone support
- **Caching**: Use `cache.tryGet()` for expensive operations
- **Puppeteer**: Available via `puppeteer` utility for dynamic content

### Important Conventions

1. **Error Handling**: Throw errors with descriptive messages; middleware handles them
2. **User Agent**: Use `config.ua` or `config.trueUA` for requests
3. **Proxy**: Automatically applied based on URL patterns
4. **Rate Limiting**: Built-in; don't implement custom delays
5. **Caching**: Use cache utilities; don't implement custom caching
6. **Language**: Prefer TypeScript; use proper types

### Environment Variables

Key environment variables (see `lib/config.ts` for full list):
- `PORT`: Server port (default: 1200)
- `CACHE_TYPE`: `memory` or `redis`
- `REDIS_URL`: Redis connection string
- `NODE_ENV`: `dev`, `test`, or `production`
- `PROXY_URI`: HTTP proxy for requests
- `ACCESS_KEY`: API authentication key

### Common Issues and Solutions

1. **Anti-crawler Protection**: Set `features.antiCrawler: true` and use appropriate headers
2. **Dynamic Content**: Set `features.requirePuppeteer: true` for JavaScript-rendered pages
3. **Authentication**: Store credentials in config, not in code
4. **Rate Limits**: Use built-in caching to reduce request frequency