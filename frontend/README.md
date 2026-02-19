# Frontend

Next.js-based frontend for the SaaS Mix platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
For **Netlify staging**, set `NEXT_PUBLIC_API_URL=https://api-staging.siberiamix.com` (must be **https**, otherwise redirect turns POST into GET → "Method Not Allowed").

3. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`
