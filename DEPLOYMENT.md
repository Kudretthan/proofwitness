# ProofWitness — Deployment Guide

---

## Backend Deploy (Render / Railway)

### Render

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add **Environment Variables**:
   - `GEMINI_API_KEY` = your Gemini API key
   - `FRONTEND_URL` = `https://your-frontend-url.vercel.app`
   - `PORT` = `4000` (Render usually assigns its own port via `PORT` env var)

### Railway

1. Create a new project on [railway.app](https://railway.app).
2. Connect your repository.
3. Set **Root Directory** to `backend`.
4. Add the same environment variables as above.

> **Note**: `backend/uploads/` uses local filesystem storage. On Render/Railway, uploaded files will be lost on redeploy. For production, migrate to IPFS, Filebase, Cloudinary, or S3.

---

## Frontend Deploy (Vercel)

1. Create a new project on [vercel.com](https://vercel.com).
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   - `VITE_API_BASE_URL` = `https://your-backend-url.onrender.com`

> **Important**: `VITE_` environment variables are baked into the frontend build at build time. If you change the backend URL, you must redeploy the frontend.

---

## Important Notes

- **API keys**: The `GEMINI_API_KEY` must only be set in the backend environment. Never expose it in the frontend.
- **CORS**: The backend allows the `FRONTEND_URL` origin. Make sure it matches your deployed frontend domain.
- **Uploads**: Local file storage is ephemeral on most PaaS platforms. For persistent evidence storage, integrate:
  - IPFS (e.g., Pinata, Filebase)
  - Cloudinary
  - AWS S3 / GCS
- **Freighter Wallet**: Users need the Freighter browser extension installed and set to **Testnet**.

---

## Checklist Before Deploying

- [ ] Backend `.env` has `GEMINI_API_KEY` set
- [ ] Backend `.env` has `FRONTEND_URL` pointing to the deployed frontend
- [ ] Frontend `.env` has `VITE_API_BASE_URL` pointing to the deployed backend
- [ ] Backend CORS is configured correctly
- [ ] Frontend is rebuilt after changing env vars
- [ ] Test `GET /api/health` on deployed backend
- [ ] Test claim creation flow end-to-end
