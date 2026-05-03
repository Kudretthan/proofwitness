# ProofWitness - Deployment Guide

## 1. Backend Deploy (Render / Railway)

### Render

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add **Environment Variables**:
   - `GEMINI_API_KEY` = your_gemini_api_key (do not share this)
   - `FRONTEND_URL` = `https://proofwitness.vercel.app` (or your frontend url)
   - `PORT` = `4000` (Render usually assigns its own port via `PORT` env var)

> **Note**: `backend/uploads/` uses local filesystem storage. On Render/Railway, uploaded files will be lost on redeploy. For production, migrate to IPFS, Filebase, Cloudinary, or S3.

## 2. Supabase Setup

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the SQL Editor.
3. Copy the contents of `supabase/schema.sql` and run it to create tables (`claims`, `verifications`, `credit_ledger`).
4. RLS is disabled / open access is used for the hackathon MVP. Production requires proper RLS policies.
5. Get your `Project URL` and `anon / public key` from Settings -> API.

## 3. Frontend Deploy (Vercel)

1. Create a new project on [vercel.com](https://vercel.com).
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   - `VITE_API_BASE_URL` = `https://proofwitness.onrender.com` (or your backend url)
   - `VITE_STAKE_MODE` = `soroban`
   - `VITE_SOROBAN_ESCROW_CONTRACT_ID` = `CCNWALULXOTPOFUIXXYC7BIDNPSJGHVUDYTPGXZZ6LRPED7ULOYSO56G`
   - `VITE_XLM_TOKEN_CONTRACT_ID` = `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
   - `VITE_STELLAR_NETWORK` = `testnet`
   - `VITE_STELLAR_RPC_URL` = `https://soroban-testnet.stellar.org`
   - `VITE_SUPABASE_URL` = `your_supabase_project_url`
   - `VITE_SUPABASE_ANON_KEY` = `your_supabase_publishable_or_anon_key`

> **Important**: `VITE_` environment variables are baked into the frontend build at build time. If you change any environment variables, you must redeploy the frontend.

**Vercel SPA Routing Note:**
- React/Vite routes like `/system` need Vercel rewrite.
- `frontend/vercel.json` should route all paths to `index.html`.
- This prevents 404 on direct route refresh.

## 4. Deployment Troubleshooting & Common Errors

- **Supabase 404 / Invalid path**:
  VITE_SUPABASE_URL should not include `/rest/v1`. It must be exactly `https://xxxxx.supabase.co`.
- **Supabase No API key**:
  VITE_SUPABASE_ANON_KEY missing or wrong env name. It should be the publishable/anon key, not the secret key.
- **Vercel env changes**:
  Redeploy required after env changes.
- **Freighter txBadAuth**:
  Payout must be started by the claim creator wallet.
- **Render cold start**:
  Backend may take 30-60 seconds on free tier.
- **Treasury Demo showing in soroban mode**:
  Check `VITE_STAKE_MODE=soroban` and redeploy.
- **Render FRONTEND_URL**:
  Must precisely match the Vercel domain (e.g., `https://proofwitness.vercel.app` without a trailing slash) so CORS works.
- **Freighter Network**:
  Freighter extension must be set to Testnet, or Soroban interactions will fail.

## 5. Checklist Before Deploying

- [ ] Backend `.env` has `GEMINI_API_KEY` set
- [ ] Backend `.env` has `FRONTEND_URL` pointing to the deployed frontend
- [ ] Frontend `.env` has `VITE_API_BASE_URL` pointing to the deployed backend
- [ ] Frontend `.env` has `VITE_STAKE_MODE=soroban` configured
- [ ] Frontend `.env` has Supabase URL and Key configured correctly (no `/rest/v1`)
- [ ] Backend CORS is configured correctly
- [ ] Frontend `vercel.json` has rewrites for SPA routing
- [ ] Frontend is rebuilt after changing env vars
- [ ] Test `GET /api/health` on deployed backend
- [ ] Freighter is connected to Testnet
