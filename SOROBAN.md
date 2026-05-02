# ProofWitness Soroban Escrow

This document describes the Soroban escrow layer used by ProofWitness on Stellar Testnet.

## Contract Purpose

The escrow contract locks Testnet XLM stake for crisis claims and human verifications. It gives ProofWitness an accountable staking layer where contributors must put value behind the information they submit.

The contract supports the ProofWitness MVP flow:

- Lock stake when a claim is created.
- Lock stake when a verification is submitted.
- Track claim and verification references through hashes and IDs.
- Resolve a claim after enough community verification is collected.
- Return stake to contributors who were on the winning side of the result.

## Contract Details

Contract ID:

```text
CCNWALULXOTPOFUIXXYC7BIDNPSJGHVUDYTPGXZZ6LRPED7ULOYSO56G
```

Native XLM Token Contract ID:

```text
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Admin address:

```text
GBQRMRIH4UCY3YKHCJAHJZII4SFQ66XBBHKKQ7PV6Z6UKJN4F7VOV2C7
```

Network:

```text
Stellar Testnet
```

RPC URL:

```text
https://soroban-testnet.stellar.org
```

## Build Command

```bash
cd contracts/proofwitness_escrow
stellar contract build
```

The compiled WASM is expected at:

```text
target/wasm32v1-none/release/proofwitness_escrow.wasm
```

## Deploy Command

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/proofwitness_escrow.wasm \
  --source <your-identity> \
  --network testnet
```

Save the returned contract ID and place it in the frontend environment as `VITE_SOROBAN_ESCROW_CONTRACT_ID`.

## Native XLM Token Contract ID

Use the Stellar CLI to resolve the native XLM token contract ID on Testnet:

```bash
stellar contract id asset --asset native --network testnet
```

For the deployed MVP, the native XLM token contract ID is:

```text
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

## Init Command

After deploy, initialize the contract with the admin account and native XLM token contract ID:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <your-identity> \
  --network testnet \
  -- \
  init \
  --admin <ADMIN_PUBLIC_KEY> \
  --xlm_token <NATIVE_XLM_TOKEN_CONTRACT_ID>
```

For the deployed MVP values:

```bash
stellar contract invoke \
  --id CCNWALULXOTPOFUIXXYC7BIDNPSJGHVUDYTPGXZZ6LRPED7ULOYSO56G \
  --source <your-identity> \
  --network testnet \
  -- \
  init \
  --admin GBQRMRIH4UCY3YKHCJAHJZII4SFQ66XBBHKKQ7PV6Z6UKJN4F7VOV2C7 \
  --xlm_token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

## Environment Variables

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

Backend `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=4000
FRONTEND_URL=http://localhost:5173
```

## What Escrow Does

In Soroban mode, ProofWitness uses smart contract logic for stake locking:

- Claim creators stake 0.5 Testnet XLM.
- Verifiers stake 0.1 Testnet XLM.
- Stakes are locked by the Soroban contract.
- Claim and verification references are recorded through hashes and IDs.
- When a claim resolves, winning contributors can receive stake back.
- False or inaccurate contributors may lose their stake depending on the final result.

The frontend still uses Freighter for user signatures. The app does not request or store private keys.

## Example Contract Flow

Create a claim with stake:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <creator-identity> \
  --network testnet \
  -- \
  create_claim_with_stake \
  --creator <CREATOR_PUBLIC_KEY> \
  --claim_id claim-001 \
  --claim_hash hash_claim_001 \
  --ai_report_hash hash_ai_001 \
  --created_at 1714650000
```

Add a verification with stake:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <verifier-identity> \
  --network testnet \
  -- \
  add_verification_with_stake \
  --verifier <VERIFIER_PUBLIC_KEY> \
  --claim_id claim-001 \
  --verification_id verify-001 \
  --decision true \
  --verification_hash hash_verify_001 \
  --evidence_hash hash_evidence_001 \
  --created_at 1714650300
```

Read claim counts:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <identity> \
  --network testnet \
  -- \
  get_counts \
  --claim_id claim-001
```

Resolve and payout:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <identity> \
  --network testnet \
  -- \
  resolve_and_payout \
  --claim_id claim-001
```

Read contract balance:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <identity> \
  --network testnet \
  -- \
  contract_balance
```

## Treasury Fallback Mode

ProofWitness also keeps a treasury fallback mode for demos and environments where Soroban is not enabled.

```env
VITE_STAKE_MODE=treasury
VITE_STAKE_TREASURY_ADDRESS=<testnet_treasury_public_key>
```

In treasury mode, Freighter signs a normal Testnet XLM payment to the configured treasury address. This proves wallet-based staking in the demo, but it does not provide decentralized escrow or automatic payout logic.

## Current Limitations

- This is a hackathon MVP contract flow.
- The escrow contract is deployed on Testnet only.
- Production use requires deeper contract security review.
- The MVP focuses on stake locking and basic payout behavior.
- Lost stake is not yet fully redistributed as a reward pool.
- Reputation credits are still local/demo state.
- Evidence files are stored by the backend, not by the contract.
- The contract stores references and hashes, not full claim or image data.

## Future Payout and Slashing Improvements

- Full reward distribution from losing stakes to accurate contributors
- Configurable claim and verification stake amounts
- Admin-controlled emergency pause
- On-chain reputation updates
- Weighted voting based on reputation
- More granular dispute outcomes
- Stronger duplicate claim protection
- Event indexing for claim, verification, payout, and slashing history
