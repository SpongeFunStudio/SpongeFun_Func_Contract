import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { Op } from './JettonConstants';
import { sign } from 'ton-crypto';

export type SpongeBobJettonAirdropConfig = {
    public_key: Buffer;
    sponge_bob_minter_address: Address;
    admin_address: Address;
    jetton_wallet_code: Cell;
};

export function spongeBobJettonAirdropConfigToCell(config: SpongeBobJettonAirdropConfig): Cell {
    return beginCell()
            .storeUint(0, 32)
            .storeCoins(0)
            .storeBuffer(config.public_key)
            .storeAddress(config.sponge_bob_minter_address)
            .storeAddress(config.admin_address)
            .storeRef(config.jetton_wallet_code)
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
        seqno: number,
        claim_amount: bigint,
        private_key: Buffer
    ) {
        
        const msgToSign = beginCell()
                .storeUint(seqno, 32)
                .storeCoins(claim_amount)
            .endCell();
        const sig = sign(msgToSign.hash(), private_key);
        
        const claimAirdropMsg = beginCell().storeBuffer(sig)
            .storeSlice(msgToSign.asSlice())
            .endCell();

        return beginCell().storeUint(Op.claim_airdrop, 32).storeUint(0, 64) // op, queryId
            .storeRef(claimAirdropMsg)
            .endCell();
    }

    async sendClaimAirdropTokenMessage(
        provider: ContractProvider,
        via: Sender,
        seqno: number,
        jetton_amount: bigint,
        private_key: Buffer,
        total_ton_amount: bigint = toNano('1')
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeBobJettonAirdrop.claimAirdropTokenMessage(seqno, jetton_amount, private_key),
            value: total_ton_amount,
        });
    }

    async getAirdropStatus(provider: ContractProvider) {
        let res = await provider.get('get_airdrop_status', []);

        let seqno = res.stack.readBigNumber();
        let total_claimed = res.stack.readBigNumber();
        let public_key = res.stack.readBigNumber();
        let sponge_bob_minter_address = res.stack.readAddress();
        let admin_address = res.stack.readAddress();
        let walletCode = res.stack.readCell();
        return {
            seqno,
            total_claimed,
            public_key,
            sponge_bob_minter_address,
            admin_address,
            walletCode,
        };
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const balance = await provider.get('get_smc_balance', []);
        return balance.stack.readBigNumber();
    }
}
