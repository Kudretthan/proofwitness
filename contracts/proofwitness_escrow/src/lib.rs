#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, String, Symbol, Vec,
};

// ─── Storage Keys ───
const KEY_ADMIN: Symbol = symbol_short!("admin");
const KEY_XLM: Symbol = symbol_short!("xlm_tok");
const KEY_INIT: Symbol = symbol_short!("inited");

// ─── Stake Amounts (stroops) ───
// 0.5 XLM = 5_000_000 stroops
const CLAIM_STAKE: i128 = 5_000_000;
// 0.1 XLM = 1_000_000 stroops
const VERIFY_STAKE: i128 = 1_000_000;

// ─── Data Types ───

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ClaimStatus {
    NeedsEvidence,
    Verified,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ClaimData {
    pub creator: Address,
    pub claim_hash: String,
    pub ai_report_hash: String,
    pub stake_amount: i128,
    pub true_count: u32,
    pub false_count: u32,
    pub unsure_count: u32,
    pub status: ClaimStatus,
    pub created_at: u64,
    pub rewards_distributed: bool,
    pub verifiers_true: Vec<Address>,
    pub verifiers_false: Vec<Address>,
    pub verifiers_unsure: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VerificationData {
    pub claim_id: String,
    pub verifier: Address,
    pub decision: Symbol,
    pub verification_hash: String,
    pub evidence_hash: String,
    pub stake_amount: i128,
    pub created_at: u64,
}

// ─── Storage helpers for claims / verifications ───

fn claim_key(claim_id: &String) -> (Symbol, String) {
    (symbol_short!("claim"), claim_id.clone())
}

fn verif_key(verification_id: &String) -> (Symbol, String) {
    (symbol_short!("verif"), verification_id.clone())
}

// ─── Contract ───

#[contract]
pub struct ProofWitnessEscrow;

#[contractimpl]
impl ProofWitnessEscrow {
    // ───────── 1. init ─────────
    pub fn init(env: Env, admin: Address, xlm_token: Address) {
        admin.require_auth();

        let already: bool = env.storage().instance().has(&KEY_INIT);
        if already {
            panic!("already initialized");
        }

        env.storage().instance().set(&KEY_ADMIN, &admin);
        env.storage().instance().set(&KEY_XLM, &xlm_token);
        env.storage().instance().set(&KEY_INIT, &true);
    }

    // ───────── 2. create_claim_with_stake ─────────
    pub fn create_claim_with_stake(
        env: Env,
        creator: Address,
        claim_id: String,
        claim_hash: String,
        ai_report_hash: String,
        created_at: u64,
    ) {
        creator.require_auth();
        Self::require_init(&env);

        let key = claim_key(&claim_id);
        if env.storage().persistent().has(&key) {
            panic!("claim already exists");
        }

        // Transfer XLM stake from creator to contract
        let xlm = Self::xlm_token(&env);
        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &xlm);
        client.transfer(&creator, &contract_addr, &CLAIM_STAKE);

        let claim = ClaimData {
            creator: creator.clone(),
            claim_hash,
            ai_report_hash,
            stake_amount: CLAIM_STAKE,
            true_count: 0,
            false_count: 0,
            unsure_count: 0,
            status: ClaimStatus::NeedsEvidence,
            created_at,
            rewards_distributed: false,
            verifiers_true: Vec::new(&env),
            verifiers_false: Vec::new(&env),
            verifiers_unsure: Vec::new(&env),
        };

        env.storage().persistent().set(&key, &claim);

        env.events()
            .publish((Symbol::new(&env, "claim_created"),), claim_id);
    }

    // ───────── 3. add_verification_with_stake ─────────
    pub fn add_verification_with_stake(
        env: Env,
        verifier: Address,
        claim_id: String,
        verification_id: String,
        decision: Symbol,
        verification_hash: String,
        evidence_hash: String,
        created_at: u64,
    ) {
        verifier.require_auth();
        Self::require_init(&env);

        let claim_k = claim_key(&claim_id);
        let mut claim: ClaimData = env
            .storage()
            .persistent()
            .get(&claim_k)
            .unwrap_or_else(|| panic!("claim not found"));

        let verif_k = verif_key(&verification_id);
        if env.storage().persistent().has(&verif_k) {
            panic!("verification already exists");
        }

        // Validate decision
        let dec_true = Symbol::new(&env, "true");
        let dec_false = Symbol::new(&env, "false");
        let dec_unsure = Symbol::new(&env, "unsure");

        if decision != dec_true && decision != dec_false && decision != dec_unsure {
            panic!("invalid decision: must be true, false, or unsure");
        }

        // Transfer stake
        let xlm = Self::xlm_token(&env);
        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &xlm);
        client.transfer(&verifier, &contract_addr, &VERIFY_STAKE);

        // Save verification
        let verif = VerificationData {
            claim_id: claim_id.clone(),
            verifier: verifier.clone(),
            decision: decision.clone(),
            verification_hash,
            evidence_hash,
            stake_amount: VERIFY_STAKE,
            created_at,
        };
        env.storage().persistent().set(&verif_k, &verif);

        // Update claim counts and verifier lists
        if decision == dec_true {
            claim.true_count += 1;
            claim.verifiers_true.push_back(verifier.clone());
        } else if decision == dec_false {
            claim.false_count += 1;
            claim.verifiers_false.push_back(verifier.clone());
        } else {
            claim.unsure_count += 1;
            claim.verifiers_unsure.push_back(verifier.clone());
        }

        // Update status
        if claim.true_count >= 3 {
            claim.status = ClaimStatus::Verified;
        } else if claim.false_count >= 2 {
            claim.status = ClaimStatus::Disputed;
        }

        env.storage().persistent().set(&claim_k, &claim);

        env.events().publish(
            (Symbol::new(&env, "verification_added"),),
            verification_id,
        );
    }

    // ───────── 4. resolve_and_payout ─────────
    pub fn resolve_and_payout(env: Env, claim_id: String) {
        Self::require_init(&env);

        let claim_k = claim_key(&claim_id);
        let mut claim: ClaimData = env
            .storage()
            .persistent()
            .get(&claim_k)
            .unwrap_or_else(|| panic!("claim not found"));

        if claim.status != ClaimStatus::Verified && claim.status != ClaimStatus::Disputed {
            panic!("claim is not resolved");
        }

        if claim.rewards_distributed {
            panic!("rewards already distributed");
        }

        let xlm = Self::xlm_token(&env);
        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &xlm);

        if claim.status == ClaimStatus::Verified {
            // Return stake to creator
            client.transfer(&contract_addr, &claim.creator, &CLAIM_STAKE);

            // Return stake to true verifiers
            for i in 0..claim.verifiers_true.len() {
                let addr = claim.verifiers_true.get(i).unwrap();
                client.transfer(&contract_addr, &addr, &VERIFY_STAKE);
            }
        } else {
            // Disputed: return stake to false verifiers only
            for i in 0..claim.verifiers_false.len() {
                let addr = claim.verifiers_false.get(i).unwrap();
                client.transfer(&contract_addr, &addr, &VERIFY_STAKE);
            }
            // Creator stake stays in contract
        }

        claim.rewards_distributed = true;
        env.storage().persistent().set(&claim_k, &claim);

        env.events()
            .publish((Symbol::new(&env, "payout_done"),), claim_id);
    }

    // ───────── 5. get_claim ─────────
    pub fn get_claim(env: Env, claim_id: String) -> ClaimData {
        let key = claim_key(&claim_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("claim not found"))
    }

    // ───────── 6. get_verification ─────────
    pub fn get_verification(env: Env, verification_id: String) -> VerificationData {
        let key = verif_key(&verification_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("verification not found"))
    }

    // ───────── 7. get_counts ─────────
    pub fn get_counts(env: Env, claim_id: String) -> (u32, u32, u32, ClaimStatus) {
        let claim = Self::get_claim(env, claim_id);
        (
            claim.true_count,
            claim.false_count,
            claim.unsure_count,
            claim.status,
        )
    }

    // ───────── 8. contract_balance ─────────
    pub fn contract_balance(env: Env) -> i128 {
        Self::require_init(&env);
        let xlm = Self::xlm_token(&env);
        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &xlm);
        client.balance(&contract_addr)
    }

    // ─── Internal Helpers ───

    fn require_init(env: &Env) {
        let inited: bool = env
            .storage()
            .instance()
            .get(&KEY_INIT)
            .unwrap_or(false);
        if !inited {
            panic!("contract not initialized");
        }
    }

    fn xlm_token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&KEY_XLM)
            .unwrap_or_else(|| panic!("xlm token not set"))
    }
}

// ─── Tests ───
#[cfg(test)]
mod test;
