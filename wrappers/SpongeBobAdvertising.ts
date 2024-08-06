import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { jettonContentToCell } from './SpongeBobJettonMinter';
import { Op } from './JettonConstants';

export type SpongeBobAdvertisingConfig = {
    price_perday: bigint;
    admin_address: Address;
    ad_cell?: Cell;
};

export function spongeBobAdvertisingConfigToCell(config: SpongeBobAdvertisingConfig): Cell {

    return beginCell()
        .storeCoins(config.price_perday)
        .storeUint(0, 64)
        .storeAddress(config.admin_address)
        .storeMaybeRef(config.ad_cell)
        .endCell();
}

export class SpongeBobAdvertising implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeBobAdvertising(address);
    }

    static createFromConfig(config: SpongeBobAdvertisingConfig, code: Cell, workchain = 0) {
        const data = spongeBobAdvertisingConfigToCell(config);
        const init = { code, data };
        return new SpongeBobAdvertising(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }
}
