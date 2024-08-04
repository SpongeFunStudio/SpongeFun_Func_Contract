export abstract class Op {
    static transfer = 0xf8a7ea5;
    static transfer_notification = 0x7362d09c;
    static internal_transfer = 0x178d4519;
    static excesses = 0xd53276db;
    static burn = 0x595f07bc;
    static burn_notification = 0x7bdd97de;
    
    // SpongeMinter Contract
    static provide_wallet_address = 0x2c76b973;
    static take_wallet_address = 0xd1735400;
    static mint_to_airdrop_contract = 0x710d7a0b;
    static change_admin = 0x6501f354;
    static upgrade = 0x2508d66a;
    static top_up = 0xd372158c;
    static change_metadata_url = 0xcb862902;

    // SpongePublicSale Contract
    static open_sale = 0x5cbf8120
    static mint_to_treasury = 0xe802c6b3;
    static mint_to_team = 0xb6b42cea;
    static mint_to_lp = 0x8677b19a;

    // SpongeAirdrop Contract
    static claim_airdrop = 0xdcee4012
    static mint_to_public_sale_contract = 0x889da273;

    static vesting_unlock_token = 0xecaf4100;
}

export abstract class Errors {
    static invalid_airdrop_amount = 71;
    static invalid_op = 72;
    static wrong_op = 0xffff;
    static not_owner = 73;
    static not_valid_wallet = 74;
    static wrong_workchain = 333;
    
    static balance_error = 47;
    static not_enough_gas = 48;
    static invalid_mesage = 49;
    static discovery_fee_not_matched = 75;
    static can_not_start_public_sale = 76;
    static invalid_signature = 78;
    static repeat_signature = 79;
    static claim_out = 80;
    static exceed_max_claim_amount = 81;

    static sale_not_start = 95;
    static not_sold_out = 96;

    static already_unlock_all = 100;
}


