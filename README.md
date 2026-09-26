# GridSync Backend — Beginner Guide

## What the backend does (simple)
- Your map page asks the backend: "give me projects" and "find overlaps"
- The backend does the math and sends back answers
- That's it. Frontend = what you see, Backend = the brain.

## How to run
1. Install Node.js from nodejs.org
2. Open terminal in this folder:
```
npm install
cp .env.example .env
npm start
```
3. Open http://localhost:3000

## The 4 jobs
- Person 1: Edit `public/index.html` to make it pretty
- Person 2: Edit `server.js` where it says THE DATA to add more projects
- Person 3: Get a free Gemini key, put in `.env` for the AI button
- Person 4: Pitch + GoDaddy domain

## If it breaks
- "npm not found" → install Node.js first
- Port in use → change PORT in `.env` to 3001
- Just want the simple version? Use the 1-file `gridsync/index.html` instead, no backend needed.
