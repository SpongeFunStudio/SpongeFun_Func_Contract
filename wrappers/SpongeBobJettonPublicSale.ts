import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeBobJettonPublicSaleConfig = {
    total_sale: bigint;
    sponge_bob_minter_address: Address;
    admin_address: Address;
    jetton_wallet_code: Cell;
};

export function spongeBobJettonPublicSaleConfigToCell(config: SpongeBobJettonPublicSaleConfig): Cell {
    return beginCell()
            .storeCoins(0)
            .storeAddress(config.sponge_bob_minter_address)
            .storeAddress(config.admin_address)
            .storeRef(config.jetton_wallet_code)
            .endCell();
}

export class SpongeBobJettonPublicSale implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeBobJettonPublicSale(address);
    }

    static createFromConfig(config: SpongeBobJettonPublicSaleConfig, code: Cell, workchain = 0) {
        const data = spongeBobJettonPublicSaleConfigToCell(config);
        const init = { code, data };
        return new SpongeBobJettonPublicSale(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }
}
