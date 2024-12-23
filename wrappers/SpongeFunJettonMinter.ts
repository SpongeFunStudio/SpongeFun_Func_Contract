import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import {Op} from './JettonConstants';

export type JettonMinterContent = {
    uri: string
};

export type SpongeFunJettonMinterConfig = {
    mintable: boolean;
    admin_address: Address;
    jetton_wallet_code: Cell;
    jetton_content: Cell | JettonMinterContent;
};

export function spongeFunJettonMinterConfigToCell(config: SpongeFunJettonMinterConfig): Cell {
    const content = config.jetton_content instanceof Cell ? config.jetton_content : jettonContentToCell(config.jetton_content);
    return beginCell()
            .storeCoins(0)
            .storeBit(config.mintable)
            .storeAddress(config.admin_address)
            .storeRef(config.jetton_wallet_code)
            .storeRef(content)
            .endCell();
}

export function jettonContentToCell(content: JettonMinterContent) {
    return beginCell()
        .storeStringRefTail(content.uri) //Snake logic under the hood
        .endCell();
}

export class SpongeFunJettonMinter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SpongeFunJettonMinter(address);
    }

    static createFromConfig(config: SpongeFunJettonMinterConfig, code: Cell, workchain = 0) {
        const data = spongeFunJettonMinterConfigToCell(config);
        const init = { code, data };
        return new SpongeFunJettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }

    static mintToAirdropContractMessage(to: Address, jetton_amount: bigint, from?: Address | null, response?: Address | null, customPayload?: Cell | null, forward_ton_amount: bigint = 0n) {
        const mintToAirdropMsg = beginCell().storeUint(Op.internal_transfer, 32)
            .storeUint(0, 64)
            .storeCoins(jetton_amount)
            .storeAddress(from)
            .storeAddress(response)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(customPayload)
            .endCell();
        return beginCell().storeUint(Op.mint_to_airdrop_contract, 32).storeUint(0, 64) // op, queryId
            .storeAddress(to)
            .storeRef(mintToAirdropMsg)
            .endCell();
    }

    async sendMintToClaimAirdropMessage(
        provider: ContractProvider,
        via: Sender,
        to: Address,
        jetton_amount: bigint,
        from?: Address | null,
        response_addr?: Address | null,
        customPayload?: Cell | null,
        forward_ton_amount: bigint = toNano('0'), total_ton_amount: bigint = toNano('0.05')
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeFunJettonMinter.mintToAirdropContractMessage(to, jetton_amount, from, response_addr, customPayload, forward_ton_amount),
            value: total_ton_amount,
        });
    }

    static topUpMessage() {
        return beginCell().storeUint(Op.top_up, 32).storeUint(0, 64) // op, queryId
            .endCell();
    }

    async sendTopUp(provider: ContractProvider, via: Sender, value: bigint = toNano('0.05')) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeFunJettonMinter.topUpMessage(),
            value: value,
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
            body: SpongeFunJettonMinter.changeAdminMessage(newOwner),
            value: toNano("0.1"),
        });
    }

    static changeContentMessage(content: Cell | JettonMinterContent) {
        const contentString = content instanceof Cell ? content.beginParse().loadStringTail() : content.uri;
        return beginCell().storeUint(Op.change_metadata_url, 32).storeUint(0, 64) // op, queryId
            .storeStringTail(contentString)
            .endCell();
    }

    async sendChangeContent(provider: ContractProvider, via: Sender, content: Cell | JettonMinterContent) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeFunJettonMinter.changeContentMessage(content),
            value: toNano("0.1"),
        });
    }

    static upgradeMessage(new_code: Cell, new_data: Cell, query_id: bigint | number = 0) {
        return beginCell().storeUint(Op.upgrade, 32).storeUint(query_id, 64)
            .storeRef(new_data)
            .storeRef(new_code)
            .endCell();
    }

    async sendUpgrade(provider: ContractProvider, via: Sender, new_code: Cell, new_data: Cell, value: bigint = toNano('0.1'), query_id: bigint | number = 0) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeFunJettonMinter.upgradeMessage(new_code, new_data, query_id),
            value
        });
    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [{
            type: 'slice',
            cell: beginCell().storeAddress(owner).endCell()
        }])
        return res.stack.readAddress()
    }

    async getJettonData(provider: ContractProvider) {
        let res = await provider.get('get_jetton_data', []);
        let totalSupply = res.stack.readBigNumber();
        let mintable = res.stack.readBoolean();
        let adminAddress = res.stack.readAddress();
        let content = res.stack.readCell();
        let walletCode = res.stack.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode,
        };
    }

    async getTotalSupply(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.totalSupply;
    }

    async getAdminAddress(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.adminAddress;
    }

    async getContent(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.content;
    }

    async getMintable(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.mintable;
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const balance = await provider.get('get_smc_balance', []);
        return balance.stack.readBigNumber();
    }
}
