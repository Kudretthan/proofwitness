# ProofWitness

ProofWitness is an AI-assisted crisis claim verification platform built on Stellar. It helps reduce misinformation during emergencies by combining AI risk analysis, human evidence, Freighter wallet signatures, XLM staking, and Soroban escrow.

## Problem

During crises, false claims spread fast. Reports about infrastructure failure, earthquake impact, explosions, road closures, emergency access, or public safety can move across communities before anyone has enough context to verify them.

False information can cause panic, misdirect aid, overload emergency channels, and reduce trust in real reports. In a crisis, speed matters, but accountability matters too.

## Solution

ProofWitness lets users:

1. Create a crisis claim.
2. Let AI analyze misinformation risk.
3. Let nearby people verify or dispute the claim with evidence.
4. Stake Testnet XLM through Freighter.
5. Lock stake logic through Soroban escrow.
6. Build wallet-based reputation through accurate contributions.

## Key Features

- AI risk analysis
- Human verification with evidence
- Freighter wallet connection
- Real Stellar Testnet XLM staking
- Soroban escrow contract
- Claim and verification hashes
- Evidence photo upload
- Reputation credits and badges
- Local persistence for demo
- Treasury fallback mode

## How It Works

1. User connects Freighter.
2. User creates a claim.
3. AI analyzes the claim text, date, time, location, and category.
4. AI does not decide the truth; it only flags risk.
5. User stakes XLM.
6. Claim becomes visible.
7. Other users verify or dispute with notes and optional evidence.
8. Each verification requires XLM stake.
9. Community result changes status:
   - 3 true verifications => Verified
   - 2 false verifications => False / Disputed
   - otherwise => Needs Evidence
10. Reputation credits are assigned to accurate contributors.
11. Soroban escrow can handle stake locking and payout logic.

## Important AI Note

AI confidence is not the probability that the event is true.

In ProofWitness, AI confidence means how confident the AI is in its risk analysis. The AI helps triage suspicious or risky claims, but it does not determine truth. Truth is determined by human evidence and community verification.

## XLM Staking

- Claim stake: 0.5 Testnet XLM
- Verification stake: 0.1 Testnet XLM
- Freighter signs transactions
- Testnet only, no real funds
- XLM makes spam and false reporting costly

## Soroban Escrow

The Soroban escrow contract was deployed on Stellar Testnet.

Contract ID:

```text
CCNWALULXOTPOFUIXXYC7BIDNPSJGHVUDYTPGXZZ6LRPED7ULOYSO56G
```

Native XLM Token Contract ID:

```text
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Admin:

```text
GBQRMRIH4UCY3YKHCJAHJZII4SFQ66XBBHKKQ7PV6Z6UKJN4F7VOV2C7
```

In Soroban mode, XLM stake is locked by smart contract logic. When a claim is resolved, winning contributors can receive stake back. False or inaccurate contributors may lose their stake depending on the result.

See [SOROBAN.md](./SOROBAN.md) for contract commands, environment variables, and current limitations.

## Reputation Credits

Reputation credits are tied to the Freighter public key. They reward accurate contributors and help identify wallets that have previously submitted useful crisis verification work.

Badge levels:

- 0-19 credits: New Witness
- 20-49 credits: Trusted Witness
- 50-99 credits: Priority Verifier
- 100+ credits: Community Verifier

In this MVP, reputation is stored locally for demo purposes. A future version can move reputation on-chain or to decentralized storage.

## Tech Stack

Frontend:

- React
- Vite
- TypeScript
- Tailwind CSS
- Freighter API
- Stellar SDK

Backend:

- Node.js
- Express
- Gemini API
- Multer upload
- CORS / dotenv

Blockchain:

- Stellar Testnet
- Freighter
- Soroban smart contract
- Native XLM token contract

## Project Structure

```text
proofwitness/
  frontend/
  backend/
  contracts/
    proofwitness_escrow/
  README.md
  SOROBAN.md
```

## Local Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=4000
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_STAKE_TREASURY_ADDRESS=GAKCKLXUOMY4CA7444ALGWFHTCH4LOGIMNLBLERCO4YA2ARJE7STQPW4
VITE_STAKE_MODE=soroban
VITE_SOROBAN_ESCROW_CONTRACT_ID=CCNWALULXOTPOFUIXXYC7BIDNPSJGHVUDYTPGXZZ6LRPED7ULOYSO56G
VITE_XLM_TOKEN_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

## Test Commands

Backend health:

```bash
curl http://localhost:4000/api/health
```

Analyze claim with PowerShell:

```powershell
$body = @{
  title = "Test"
  description = "Test description"
  location = "Test location"
  incidentDate = "2026-05-02"
  incidentTime = "14:30"
  category = "other"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/api/analyze-claim" -Method POST -ContentType "application/json" -Body $body
```

Frontend build:

```bash
cd frontend
npm run build
```

Soroban build:

```bash
cd contracts/proofwitness_escrow
stellar contract build
```

## Demo Flow

1. Open the app.
2. Connect Freighter on Testnet.
3. Create a crisis claim.
4. Approve XLM stake transaction.
5. AI risk analysis appears.
6. Add verification with note and optional evidence.
7. Approve verification stake transaction.
8. Add enough verifications to resolve the claim.
9. Run payout / observe reputation credits.
10. Show transaction hashes and Soroban contract details.

## Deployment

Backend:

- Render or Railway
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Env:
  - `GEMINI_API_KEY`
  - `FRONTEND_URL`

Frontend:

- Vercel
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Env:
  - `VITE_API_BASE_URL`
  - `VITE_STAKE_MODE`
  - `VITE_SOROBAN_ESCROW_CONTRACT_ID`
  - `VITE_XLM_TOKEN_CONTRACT_ID`
  - `VITE_STELLAR_NETWORK`
  - `VITE_STELLAR_RPC_URL`
  - `VITE_STAKE_TREASURY_ADDRESS`

## Limitations

- This is a hackathon MVP.
- Evidence upload uses backend local storage.
- AI does not verify real-world truth.
- Reputation is local/demo state.
- Production needs persistent storage.
- Production Soroban escrow needs deeper security review.
- Image content is not yet fully analyzed by AI.
- Real disaster data integrations are future work.

## Future Work

- IPFS/Filebase evidence storage
- AFAD/Kandilli or official data integrations
- Map-based nearby verification
- On-chain reputation
- Weighted voting
- Full Soroban escrow reward distribution
- Mobile-first field reporter mode
- AI image verification
- Notification system

## One-liner Pitch

ProofWitness turns crisis reporting into an accountable, evidence-based process by combining AI triage, human verification, Freighter-signed XLM staking, and Soroban escrow.
