# Project Guide - Understanding the Structure

## 🎯 What We're Building

A web application with two main parts:
1. **Backend** (Python) - Does the heavy lifting: processes audio, runs AI models, stores data
2. **Frontend** (Next.js/React) - What users see and interact with in their browser

Think of it like a restaurant:
- **Frontend** = The dining room (where customers sit and order)
- **Backend** = The kitchen (where food is prepared)

## 📁 Project Structure Explained

```
SaaS Mix/
├── backend/              # Python code (the "kitchen")
│   ├── main.py          # Main server file - starts the API
│   ├── requirements.txt # List of Python packages we need
│   └── .env.example     # Template for configuration settings
│
├── frontend/            # React/Next.js code (the "dining room")
│   ├── app/             # Main application pages
│   │   ├── page.tsx     # Home page
│   │   └── layout.tsx   # Page wrapper
│   ├── package.json     # List of JavaScript packages we need
│   └── tailwind.config.js # Styling configuration
│
├── README.md            # Project overview
├── .gitignore           # Files to exclude from version control
└── PROJECT_GUIDE.md     # This file!
```

## 🔧 Key Technologies (Simple Explanations)

### Backend (Python)
- **FastAPI**: Web framework - creates the API endpoints (like a waiter taking orders)
- **PostgreSQL**: Database - stores user data, projects, file info
- **Celery**: Task queue - handles long-running jobs (like processing audio)
- **librosa**: Audio library - analyzes and processes audio files

### Frontend (JavaScript/TypeScript)
- **Next.js**: React framework - builds the web pages
- **React**: UI library - creates interactive components
- **Tailwind CSS**: Styling - makes things look good
- **TypeScript**: JavaScript with type safety - catches errors early

## 🚀 How It Works (High Level)

1. **User uploads files** → Frontend sends to Backend
2. **Backend receives files** → Validates, stores in S3
3. **User selects preset** → Frontend sends choice to Backend
4. **Backend processes audio** → Applies effects, mixes tracks
5. **Backend returns results** → Frontend shows download links

**Detailed UX (tracks, mix, preview, render, mastering):** see **[PRODUCT_UX_SPEC.md](PRODUCT_UX_SPEC.md)** — pistes illimitées, gain en temps réel, bouton Mix par piste vocale, preview intégral, deux boutons (Télécharger / Masteriser), avant-après mastering.

## 📝 Next Steps

We'll build this step by step:
1. ✅ Project setup (DONE!)
2. ⏳ Backend API endpoints
3. ⏳ Database models
4. ⏳ Audio processing
5. ⏳ Frontend UI
6. ⏳ Connect everything together

## 💡 Learning Tips

- **Don't worry if you don't understand everything** - that's normal!
- **Ask questions** - I'll explain anything you want to know
- **We'll build incrementally** - each piece builds on the last
- **You'll learn by seeing it work** - hands-on is the best way

## 🛠️ Running the Project (When Ready)

### Backend:
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```

But we'll do this together when we're ready!
