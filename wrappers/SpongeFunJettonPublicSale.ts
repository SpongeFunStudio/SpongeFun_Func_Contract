import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeFunJettonPublicSaleConfig = {
    sponge_fun_minter_address: Address;
    admin_address: Address;
    jetton_wallet_code: Cell;
};

export function spongeFunJettonPublicSaleConfigToCell(config: SpongeFunJettonPublicSaleConfig): Cell {
    return beginCell()
            .storeCoins(0)
            .storeBit(false)
            .storeAddress(config.sponge_fun_minter_address)
            .storeAddress(config.admin_address)
            .storeRef(config.jetton_wallet_code)
            .endCell();
}

export class SpongeFunJettonPublicSale implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeFunJettonPublicSale(address);
    }

    static createFromConfig(config: SpongeFunJettonPublicSaleConfig, code: Cell, workchain = 0) {
        const data = spongeFunJettonPublicSaleConfigToCell(config);
        const init = { code, data };
        return new SpongeFunJettonPublicSale(contractAddress(workchain, init), init);
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

    async sendMintToTeamMessage(provider: ContractProvider, via: Sender, value: bigint, team: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.mint_to_team, 32).storeUint(0, 64)
                .storeAddress(team)
                .endCell(),
        });
    }

    async sendMintToLpMessage(provider: ContractProvider, via: Sender, value: bigint, lp: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.mint_to_lp, 32).storeUint(0, 64)
                .storeAddress(lp)
                .endCell(),
        });
    }

    async sendWithdrawMessage(provider: ContractProvider, via: Sender, value: bigint, amount: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.withdraw, 32).storeUint(0, 64)
                .storeCoins(amount)
                .endCell(),
        });
    }

    async sendStartSaleTokenMessage(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.open_sale, 32).storeUint(0, 64).endCell(),
        });
    }

    static changeAdminMessage(newOwner: Address) {
        return beginCell().storeUint(Op.change_admin, 32).storeUint(0, 64) // op, queryId
            .storeAddress(newOwner)
            .endCell();
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeFunJettonPublicSale.changeAdminMessage(newOwner),
            value: toNano("0.1"),
        });
    }

    async getPublicSaleStatus(provider: ContractProvider) {
        let res = await provider.get('get_publi_sale_status', []);

        let total_sale = res.stack.readBigNumber();
        let start_sale = res.stack.readBoolean();
        let sponge_fun_minter_address = res.stack.readAddress();
        let admin_address = res.stack.readAddress();
        let walletCode = res.stack.readCell();
        return {
            total_sale,
            start_sale,
            sponge_fun_minter_address,
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
