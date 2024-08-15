import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeFunAdvertisingConfig = {
    price_perday: bigint;
    sponge_price_perday: bigint;
    admin_address: Address;
    sponge_fun_minter_address: Address;
    jetton_wallet_code: Cell;
    ad_cell?: Cell;
};

export function spongeFunAdvertisingConfigToCell(config: SpongeFunAdvertisingConfig): Cell {

    return beginCell()
        .storeCoins(config.price_perday)
        .storeCoins(config.sponge_price_perday)
        .storeUint(0, 64)
        .storeAddress(config.admin_address)
        .storeAddress(config.sponge_fun_minter_address)
        .storeRef(config.jetton_wallet_code)
        .storeMaybeRef(config.ad_cell)
        .endCell();
}

export class SpongeFunAdvertising implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeFunAdvertising(address);
    }

    static createFromConfig(config: SpongeFunAdvertisingConfig, code: Cell, workchain = 0) {
        const data = spongeFunAdvertisingConfigToCell(config);
        const init = { code, data };
        return new SpongeFunAdvertising(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }
}
