import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeBobJettonAirdropConfig = {
    public_key: Buffer;
    sponge_bob_minter_address: Address;
    admin_address: Address;
};

export function spongeBobJettonAirdropConfigToCell(config: SpongeBobJettonAirdropConfig): Cell {
    return beginCell()
            .storeUint(0, 32)
            .storeCoins(0)
            .storeBuffer(config.public_key)
            .storeAddress(config.sponge_bob_minter_address)
            .storeAddress(config.admin_address)
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
}
