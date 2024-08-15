import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeFunJettonVestingLockupConfig = {
    sponge_fun_minter_address: Address;
    admin_address: Address;
    total_lock_amount: bigint;
    start_time: bigint;
    total_duration: number;
    unlock_period: number;
    cliff_duration: number;
    jetton_wallet_code: Cell;
};

export function spongeFunJettonVestingLockupConfigToCell(config: SpongeFunJettonVestingLockupConfig): Cell {
    return beginCell()
            .storeAddress(config.sponge_fun_minter_address)
            .storeAddress(config.admin_address)
            .storeCoins(config.total_lock_amount)
            .storeCoins(0)
            .storeUint(config.start_time, 64)
            .storeUint(config.total_duration, 32)
            .storeUint(config.unlock_period, 32)
            .storeUint(config.cliff_duration, 32)
            .storeRef(config.jetton_wallet_code)
            .endCell();
}

export class SpongeFunJettonVestingLockup implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeFunJettonVestingLockup(address);
    }

    static createFromConfig(config: SpongeFunJettonVestingLockupConfig, code: Cell, workchain = 0) {
        const data = spongeFunJettonVestingLockupConfigToCell(config);
        const init = { code, data };
        return new SpongeFunJettonVestingLockup(contractAddress(workchain, init), init);
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

    async getVestingUnLockStatus(provider: ContractProvider) {
        let res = await provider.get('get_vesting_unlock_status', []);

        let sponge_fun_minter_address = res.stack.readAddress();
        let admin_address = res.stack.readAddress();

        let total_lock_amount = res.stack.readBigNumber();
        let already_unlocked_amount = res.stack.readBigNumber();
        let start_time = res.stack.readBigNumber();
        let total_duration = res.stack.readBigNumber();
        let unlock_period = res.stack.readBigNumber();
        let cliff_diration = res.stack.readBigNumber();
        let walletCode = res.stack.readCell();

        return {
            sponge_fun_minter_address,
            admin_address,
            start_time,
            total_lock_amount,
            already_unlocked_amount,
            total_duration,
            unlock_period,
            cliff_diration,
            walletCode,
        };
    }

    async getTotalLockAmount(provider: ContractProvider) { 
        let res = await this.getVestingUnLockStatus(provider);
        return res.total_lock_amount;
    }

    async getAlreadyUnlockAmount(provider: ContractProvider) { 
        let res = await this.getVestingUnLockStatus(provider);
        return res.already_unlocked_amount;
    }
}
