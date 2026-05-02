# ProofWitness — Deployment Guide

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
4. (MVP only) RLS is disabled by the script so the application can write without auth. In production, enable RLS and add strict policies.
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
   - `VITE_STAKE_TREASURY_ADDRESS` = `GAKCKLXUOMY4CA7444ALGWFHTCH4LOGIMNLBLERCO4YA2ARJE7STQPW4`
   - `VITE_STAKE_MODE` = `soroban`
   - `VITE_SOROBAN_ESCROW_CONTRACT_ID` = `CCNWALULXOTPOFUIXXYC7BIDNPSJGHVUDYTPGXZZ6LRPED7ULOYSO56G`
   - `VITE_XLM_TOKEN_CONTRACT_ID` = `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
   - `VITE_STELLAR_NETWORK` = `testnet`
   - `VITE_STELLAR_RPC_URL` = `https://soroban-testnet.stellar.org`
   - `VITE_SUPABASE_URL` = `your_supabase_project_url`
   - `VITE_SUPABASE_ANON_KEY` = `your_supabase_publishable_or_anon_key`

> **Important**: `VITE_` environment variables are baked into the frontend build at build time. If you change any environment variables, you must redeploy the frontend.

## 4. Common Errors

- **Supabase URL Format**: `VITE_SUPABASE_URL` must be the base URL (e.g., `https://xxxxx.supabase.co`), NOT the `/rest/v1` endpoint.
- **Supabase Key**: `VITE_SUPABASE_ANON_KEY` must be the publishable/anon key, not the `service_role` key.
- **Render FRONTEND_URL**: Must precisely match the Vercel domain (e.g., `https://proofwitness.vercel.app` without a trailing slash) so CORS works.
- **Redeploying**: If you add or modify environment variables in Vercel, you must manually trigger a new deployment.
- **Freighter Network**: Freighter extension must be set to Testnet, or Soroban interactions will fail.

## 5. Checklist Before Deploying

- [ ] Backend `.env` has `GEMINI_API_KEY` set
- [ ] Backend `.env` has `FRONTEND_URL` pointing to the deployed frontend
- [ ] Frontend `.env` has `VITE_API_BASE_URL` pointing to the deployed backend
- [ ] Frontend `.env` has Supabase URL and Key configured
- [ ] Backend CORS is configured correctly
- [ ] Frontend is rebuilt after changing env vars
- [ ] Test `GET /api/health` on deployed backend
- [ ] Freighter is connected to Testnet
