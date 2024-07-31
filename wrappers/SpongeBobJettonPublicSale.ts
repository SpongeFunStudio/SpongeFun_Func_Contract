import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeBobJettonPublicSaleConfig = {
    sponge_bob_minter_address: Address;
    admin_address: Address;
    jetton_wallet_code: Cell;
};

export function spongeBobJettonPublicSaleConfigToCell(config: SpongeBobJettonPublicSaleConfig): Cell {
    return beginCell()
            .storeCoins(0)
            .storeBit(false)
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

    async sendBuyTokenMessage(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendStartSaleTokenMessage(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.open_sale, 32).storeUint(0, 64).endCell(),
        });
    }

    async getPublicSaleStatus(provider: ContractProvider) {
        let res = await provider.get('get_publi_sale_status', []);

        let total_sale = res.stack.readBigNumber();
        let start_sale = res.stack.readBoolean();
        let sponge_bob_minter_address = res.stack.readAddress();
        let admin_address = res.stack.readAddress();
        let walletCode = res.stack.readCell();
        return {
            total_sale,
            start_sale,
            sponge_bob_minter_address,
            admin_address,
            walletCode,
        };
    }

    async getAdminAddress(provider: ContractProvider) {
        let res = await this.getPublicSaleStatus(provider);
        return res.admin_address;
    }

    async getTotalSale(provider: ContractProvider) {
        let res = await this.getPublicSaleStatus(provider);
        return res.total_sale;
    }

    async getBStartSale(provider: ContractProvider) {
        let res = await this.getPublicSaleStatus(provider);
        return res.start_sale;
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const balance = await provider.get('get_smc_balance', []);
        return balance.stack.readBigNumber();
    }
}
