import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type SpongeBobJettonWalletConfig = {};

export function spongeBobJettonWalletConfigToCell(config: SpongeBobJettonWalletConfig): Cell {
    return beginCell().endCell();
}

export class SpongeBobJettonWallet implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeBobJettonWallet(address);
    }

    static createFromConfig(config: SpongeBobJettonWalletConfig, code: Cell, workchain = 0) {
        const data = spongeBobJettonWalletConfigToCell(config);
        const init = { code, data };
        return new SpongeBobJettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
