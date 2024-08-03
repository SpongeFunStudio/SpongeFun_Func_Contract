import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { Op } from './JettonConstants';
import { sign } from 'ton-crypto';

export type SpongeBobJettonAirdropConfig = {
    public_key: Buffer;
    sponge_bob_minter_address: Address;
    admin_address: Address;
    jetton_wallet_code: Cell;
    claimed_hashmap?: Cell;
};

export function spongeBobJettonAirdropConfigToCell(config: SpongeBobJettonAirdropConfig): Cell {
    return beginCell()
            .storeCoins(0)
            .storeBuffer(config.public_key)
            .storeAddress(config.sponge_bob_minter_address)
            .storeAddress(config.admin_address)
            .storeRef(config.jetton_wallet_code)
            .storeMaybeRef(config.claimed_hashmap)
            .endCell();
}

export class SpongeBobJettonAirdrop implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeBobJettonAirdrop(address);
    }

    static createFromConfig(config: SpongeBobJettonAirdropConfig, code: Cell, workchain = 0) {
        const data = spongeBobJettonAirdropConfigToCell(config);
        const init = { code, data };
        return new SpongeBobJettonAirdrop(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }

    static claimAirdropTokenMessage (
        timestamp: number,
        claim_amount: bigint,
        private_key: Buffer
    ) {
        
        const msgToSign = beginCell()
                .storeUint(timestamp, 32)
                .storeCoins(claim_amount)
            .endCell();
        const sig = sign(msgToSign.hash(), private_key);
        
        // const claimAirdropMsg = beginCell()
        //     .storeSlice(msgToSign.asSlice())
        //     .endCell();

        return beginCell().storeUint(Op.claim_airdrop, 32).storeUint(0, 64) // op, queryId
            .storeBuffer(sig)
            .storeRef(msgToSign)
            .endCell();
    }

    async sendClaimAirdropTokenMessage(
        provider: ContractProvider,
        via: Sender,
        timestamp: number,
        jetton_amount: bigint,
        private_key: Buffer,
        total_ton_amount: bigint = toNano('0.05')
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeBobJettonAirdrop.claimAirdropTokenMessage(timestamp, jetton_amount, private_key),
            value: total_ton_amount,
        });
    }

    static changeAdminMessage(newOwner: Address) {
        return beginCell().storeUint(Op.change_admin, 32).storeUint(0, 64) // op, queryId
            .storeAddress(newOwner)
            .endCell();
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeBobJettonAirdrop.changeAdminMessage(newOwner),
            value: toNano("0.1"),
        });
    }

    async sendMintToPublicSaleContractMessage(
        provider: ContractProvider,
        via: Sender,
        public_sale_contract_address: Address,
        total_ton_amount: bigint = toNano('1')
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.mint_to_public_sale_contract, 32)
                .storeUint(0, 64)
                .storeAddress(public_sale_contract_address)
                .endCell(),
            value: total_ton_amount,
        });
    }

    static topUpMessage() {
        return beginCell().storeUint(Op.top_up, 32).storeUint(0, 64) // op, queryId
            .endCell();
    }

    async sendTopUp(provider: ContractProvider, via: Sender, value: bigint = toNano('1')) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeBobJettonAirdrop.topUpMessage(),
            value: value,
        });
    }

    async getAirdropStatus(provider: ContractProvider) {
        let res = await provider.get('get_airdrop_status', []);

        let total_claimed = res.stack.readBigNumber();
        let public_key = res.stack.readBigNumber();
        let sponge_bob_minter_address = res.stack.readAddress();
        let admin_address = res.stack.readAddress();
        let walletCode = res.stack.readCell();
        return {
            total_claimed,
            public_key,
            sponge_bob_minter_address,
            admin_address,
            walletCode,
        };
    }

     async getAdminAddress(provider: ContractProvider) {
        let res = await this.getAirdropStatus(provider);
        return res.admin_address;
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const balance = await provider.get('get_smc_balance', []);
        return balance.stack.readBigNumber();
    }
}
