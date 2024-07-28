import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type SpongeBobJettonAirdropConfig = {};

export function spongeBobJettonAirdropConfigToCell(config: SpongeBobJettonAirdropConfig): Cell {
    return beginCell().endCell();
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
            body: beginCell().endCell(),
        });
    }
}
