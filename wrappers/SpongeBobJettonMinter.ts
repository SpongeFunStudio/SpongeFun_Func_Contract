import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type SpongeBobJettonMinterConfig = {};

export function spongeBobJettonMinterConfigToCell(config: SpongeBobJettonMinterConfig): Cell {
    return beginCell().endCell();
}

export class SpongeBobJettonMinter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeBobJettonMinter(address);
    }

    static createFromConfig(config: SpongeBobJettonMinterConfig, code: Cell, workchain = 0) {
        const data = spongeBobJettonMinterConfigToCell(config);
        const init = { code, data };
        return new SpongeBobJettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
