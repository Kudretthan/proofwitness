-- Create Claims table
CREATE TABLE claims (
    id text PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    incident_date text NOT NULL,
    incident_time text NOT NULL,
    category text NOT NULL,
    creator_wallet text NOT NULL,
    ai jsonb,
    status text NOT NULL,
    created_at text NOT NULL,
    claim_hash text NOT NULL,
    ai_report_hash text NOT NULL,
    stake_amount text NOT NULL,
    stake_tx_hash text NOT NULL,
    reward_credits integer DEFAULT 0,
    rewards_distributed boolean DEFAULT false,
    payout_tx_hash text,
    soroban_synced boolean,
    soroban_tx_hash text
);

-- Create Verifications table
CREATE TABLE verifications (
    id text PRIMARY KEY,
    claim_id text REFERENCES claims(id) ON DELETE CASCADE,
    verifier_wallet text NOT NULL,
    decision text NOT NULL,
    note text,
    evidence_url text,
    created_at text NOT NULL,
    verification_hash text NOT NULL,
    stake_amount text NOT NULL,
    stake_tx_hash text NOT NULL,
    reward_credits integer DEFAULT 0
);

-- Create Credit Ledger table
CREATE TABLE credit_ledger (
    wallet text PRIMARY KEY,
    credits integer DEFAULT 0
);

-- Disable Row Level Security (RLS) for Hackathon MVP
-- Warning: In a production environment, you should enable RLS and define proper policies.
ALTER TABLE claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger DISABLE ROW LEVEL SECURITY;

-- If you prefer enabling RLS but allowing public access (alternative MVP approach):
-- ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all actions" ON claims FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all actions" ON verifications FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all actions" ON credit_ledger FOR ALL USING (true) WITH CHECK (true);
