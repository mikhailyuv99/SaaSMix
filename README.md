# SaaS Mix - Automatic Vocal Mixing Platform

A web-based SaaS platform that automatically mixes raw vocal stems with instrumentals, producing professional-quality results for Hip-Hop and R&B artists.

## Project Overview

This platform allows users to:
- Upload raw vocal stems and instrumentals (WAV format)
- Select from 3 professional presets (Hip-Hop/R&B focused)
- Adjust reverb intensity and delay tempo/intensity
- Get automatically mixed outputs: full mix + processed vocal stem
- Process in under 30 seconds

## Tech Stack

**Backend:**
- Python 3.11+ with FastAPI
- PostgreSQL database
- Celery + Redis for task queue
- AWS S3 for file storage
- Audio processing: librosa, soundfile, scipy

**Frontend:**
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- Web Audio API for playback

## Project Structure

```
saas-mix/
├── backend/          # Python FastAPI backend
├── frontend/         # Next.js frontend
├── ml-models/        # ML models for audio processing
└── docs/             # Documentation
```

## Getting Started

See individual README files in backend/ and frontend/ directories.

## Development Roadmap

1. ✅ Project setup
2. ⏳ Backend API foundation
3. ⏳ Database setup
4. ⏳ Audio processing engine
5. ⏳ Frontend UI
6. ⏳ ML integration
7. ⏳ Testing & optimization
