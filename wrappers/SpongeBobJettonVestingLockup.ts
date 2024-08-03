import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type SpongeBobJettonVestingLockupConfig = {};

export function spongeBobJettonVestingLockupConfigToCell(config: SpongeBobJettonVestingLockupConfig): Cell {
    return beginCell().endCell();
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
            body: beginCell().endCell(),
        });
    }
}
