import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeBobJettonVestingLockupConfig = {
    sponge_bob_minter_address: Address;
    admin_address: Address;
    start_time: number;
    total_duration: number;
    unlock_period: number;
    cliff_duration: number;
    total_lock_amount: number;
    jetton_wallet_code: Cell;
};

export function spongeBobJettonVestingLockupConfigToCell(config: SpongeBobJettonVestingLockupConfig): Cell {
    return beginCell()
            .storeAddress(config.sponge_bob_minter_address)
            .storeAddress(config.admin_address)
            .storeUint(config.start_time, 64)
            .storeUint(config.total_duration, 32)
            .storeUint(config.unlock_period, 32)
            .storeUint(config.cliff_duration, 32)
            .storeCoins(config.total_lock_amount)
            .storeRef(config.jetton_wallet_code)
            .endCell();
}

export class SpongeBobJettonVestingLockup implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeBobJettonVestingLockup(address);
    }

    static createFromConfig(config: SpongeBobJettonVestingLockupConfig, code: Cell, workchain = 0) {
        const data = spongeBobJettonVestingLockupConfigToCell(config);
        const init = { code, data };
        return new SpongeBobJettonVestingLockup(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }

    async sendVestingLockupMessage(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.vesting_unlock_token, 32).storeUint(0, 64).endCell(),
        });
    }
}
