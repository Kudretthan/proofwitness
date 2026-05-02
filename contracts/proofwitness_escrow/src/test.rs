#![cfg(test)]
extern crate std;

use crate::{ClaimStatus, ProofWitnessEscrow, ProofWitnessEscrowClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, String, Symbol,
};

// ─── Test Helpers ───

fn setup_env() -> (
    Env,
    Address,                           // contract id
    ProofWitnessEscrowClient<'static>, // contract client
    Address,                           // admin
    Address,                           // xlm token
    TokenClient<'static>,              // xlm client
    StellarAssetClient<'static>,       // xlm admin client
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofWitnessEscrow, ());
    let client = ProofWitnessEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    // Deploy a test token (simulates native XLM SAC)
    let xlm_admin = Address::generate(&env);
    let xlm_id = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = xlm_id.address();
    let xlm_client = TokenClient::new(&env, &xlm_token);
    let xlm_sac = StellarAssetClient::new(&env, &xlm_token);

    // Initialize contract
    client.init(&admin, &xlm_token);

    (env, contract_id, client, admin, xlm_token, xlm_client, xlm_sac)
}

fn fund_account(sac: &StellarAssetClient, to: &Address, amount: i128) {
    sac.mint(to, &amount);
}

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ─── Tests ───

#[test]
fn test_init_works() {
    let (_env, _, client, _, _, _, _) = setup_env();
    // Should be able to query balance after init
    let bal = client.contract_balance();
    assert_eq!(bal, 0);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_init_fails() {
    let (_env, _, client, admin, xlm_token, _, _) = setup_env();
    client.init(&admin, &xlm_token);
}

#[test]
fn test_create_claim_with_stake() {
    let (env, contract_id, client, _, _, xlm_client, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-1");
    let claim_hash = make_string(&env, "hash123");
    let ai_hash = make_string(&env, "aihash123");

    client.create_claim_with_stake(&creator, &claim_id, &claim_hash, &ai_hash, &1000u64);

    // Check stake transferred
    assert_eq!(xlm_client.balance(&creator), 5_000_000); // 10M - 5M
    assert_eq!(xlm_client.balance(&contract_id), 5_000_000);

    // Check claim data
    let claim = client.get_claim(&claim_id);
    assert_eq!(claim.creator, creator);
    assert_eq!(claim.status, ClaimStatus::NeedsEvidence);
    assert_eq!(claim.rewards_distributed, false);
}

#[test]
fn test_add_verification_increments_counts() {
    let (env, _, client, _, _, _, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-2");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    let verifier = Address::generate(&env);
    fund_account(&xlm_sac, &verifier, 5_000_000);

    let dec_true = Symbol::new(&env, "true");
    client.add_verification_with_stake(
        &verifier,
        &claim_id,
        &make_string(&env, "v-1"),
        &dec_true,
        &make_string(&env, "vh"),
        &make_string(&env, "eh"),
        &2000u64,
    );

    let (tc, fc, uc, status) = client.get_counts(&claim_id);
    assert_eq!(tc, 1);
    assert_eq!(fc, 0);
    assert_eq!(uc, 0);
    assert_eq!(status, ClaimStatus::NeedsEvidence);
}

#[test]
fn test_three_true_makes_verified() {
    let (env, _, client, _, _, _, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-3");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    let dec_true = Symbol::new(&env, "true");

    for i in 0..3 {
        let v = Address::generate(&env);
        fund_account(&xlm_sac, &v, 5_000_000);
        let vid = make_string(&env, &std::format!("v-{}", i));
        client.add_verification_with_stake(
            &v,
            &claim_id,
            &vid,
            &dec_true,
            &make_string(&env, "vh"),
            &make_string(&env, "eh"),
            &(2000 + i as u64),
        );
    }

    let (tc, _, _, status) = client.get_counts(&claim_id);
    assert_eq!(tc, 3);
    assert_eq!(status, ClaimStatus::Verified);
}

#[test]
fn test_two_false_makes_disputed() {
    let (env, _, client, _, _, _, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-4");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    let dec_false = Symbol::new(&env, "false");

    for i in 0..2 {
        let v = Address::generate(&env);
        fund_account(&xlm_sac, &v, 5_000_000);
        let vid = make_string(&env, &std::format!("vf-{}", i));
        client.add_verification_with_stake(
            &v,
            &claim_id,
            &vid,
            &dec_false,
            &make_string(&env, "vh"),
            &make_string(&env, "eh"),
            &(2000 + i as u64),
        );
    }

    let (_, fc, _, status) = client.get_counts(&claim_id);
    assert_eq!(fc, 2);
    assert_eq!(status, ClaimStatus::Disputed);
}

#[test]
fn test_payout_verified() {
    let (env, _contract_id, client, _, _, xlm_client, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-5");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    let dec_true = Symbol::new(&env, "true");
    let mut true_verifiers = soroban_sdk::Vec::<Address>::new(&env);

    for i in 0..3 {
        let v = Address::generate(&env);
        fund_account(&xlm_sac, &v, 5_000_000);
        true_verifiers.push_back(v.clone());
        let vid = make_string(&env, &std::format!("v5-{}", i));
        client.add_verification_with_stake(
            &v,
            &claim_id,
            &vid,
            &dec_true,
            &make_string(&env, "vh"),
            &make_string(&env, "eh"),
            &(2000 + i as u64),
        );
    }

    // Before payout: creator has 5M (10M-5M), each verifier has 4M (5M-1M)
    assert_eq!(xlm_client.balance(&creator), 5_000_000);

    client.resolve_and_payout(&claim_id);

    // After payout: creator gets 5M back = 10M total
    assert_eq!(xlm_client.balance(&creator), 10_000_000);

    // Each true verifier gets 1M back = 5M total
    for i in 0..3 {
        let v = true_verifiers.get(i).unwrap();
        assert_eq!(xlm_client.balance(&v), 5_000_000);
    }

    // Rewards distributed flag
    let claim = client.get_claim(&claim_id);
    assert_eq!(claim.rewards_distributed, true);
}

#[test]
fn test_payout_disputed() {
    let (env, _contract_id, client, _, _, xlm_client, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-6");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    let dec_false = Symbol::new(&env, "false");
    let mut false_verifiers = soroban_sdk::Vec::<Address>::new(&env);

    for i in 0..2 {
        let v = Address::generate(&env);
        fund_account(&xlm_sac, &v, 5_000_000);
        false_verifiers.push_back(v.clone());
        let vid = make_string(&env, &std::format!("v6-{}", i));
        client.add_verification_with_stake(
            &v,
            &claim_id,
            &vid,
            &dec_false,
            &make_string(&env, "vh"),
            &make_string(&env, "eh"),
            &(2000 + i as u64),
        );
    }

    // Before payout: creator has 5M
    assert_eq!(xlm_client.balance(&creator), 5_000_000);

    client.resolve_and_payout(&claim_id);

    // After payout: creator does NOT get stake back
    assert_eq!(xlm_client.balance(&creator), 5_000_000);

    // False verifiers get their 1M back = 5M total
    for i in 0..2 {
        let v = false_verifiers.get(i).unwrap();
        assert_eq!(xlm_client.balance(&v), 5_000_000);
    }

    let claim = client.get_claim(&claim_id);
    assert_eq!(claim.rewards_distributed, true);
}

#[test]
#[should_panic(expected = "rewards already distributed")]
fn test_double_payout_fails() {
    let (env, _, client, _, _, _, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-7");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    let dec_true = Symbol::new(&env, "true");
    for i in 0..3 {
        let v = Address::generate(&env);
        fund_account(&xlm_sac, &v, 5_000_000);
        let vid = make_string(&env, &std::format!("v7-{}", i));
        client.add_verification_with_stake(
            &v,
            &claim_id,
            &vid,
            &dec_true,
            &make_string(&env, "vh"),
            &make_string(&env, "eh"),
            &(2000 + i as u64),
        );
    }

    client.resolve_and_payout(&claim_id);
    client.resolve_and_payout(&claim_id); // should panic
}

#[test]
#[should_panic(expected = "claim is not resolved")]
fn test_payout_unresolved_fails() {
    let (env, _, client, _, _, _, xlm_sac) = setup_env();

    let creator = Address::generate(&env);
    fund_account(&xlm_sac, &creator, 10_000_000);

    let claim_id = make_string(&env, "claim-8");
    client.create_claim_with_stake(
        &creator,
        &claim_id,
        &make_string(&env, "h"),
        &make_string(&env, "a"),
        &1000u64,
    );

    client.resolve_and_payout(&claim_id); // should panic - NeedsEvidence
}
