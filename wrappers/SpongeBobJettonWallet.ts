import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './JettonConstants';

export type SpongeBobJettonWalletConfig = {
    ownerAddress: Address,
    jettonMasterAddress: Address,
    jetton_wallet_code: Cell,
};

export function spongeBobJettonWalletConfigToCell(config: SpongeBobJettonWalletConfig): Cell {
    return beginCell()
        .storeCoins(0) // jetton balance
        .storeAddress(config.ownerAddress)
        .storeAddress(config.jettonMasterAddress)
        .storeRef(config.jetton_wallet_code)
        .endCell();
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

    async getWalletData(provider: ContractProvider) {
        let { stack } = await provider.get('get_wallet_data', []);
        return {
            balance: stack.readBigNumber(),
            owner: stack.readAddress(),
            minter: stack.readAddress(),
            wallet_code: stack.readCell()
        }
    }
    async getJettonBalance(provider: ContractProvider) {
        let res = await provider.get('get_wallet_data', []);
        return res.stack.readBigNumber();
    }

    static transferMessage(
        jetton_amount: bigint, to: Address,
        responseAddress:Address | null,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null
    ) {

        return beginCell()
                .storeUint(Op.transfer, 32)
                .storeUint(0, 64) // op, queryId
                .storeCoins(jetton_amount)
                .storeAddress(to)
                .storeAddress(responseAddress)
                .storeMaybeRef(customPayload)
                .storeCoins(forward_ton_amount)
                .storeMaybeRef(forwardPayload)
                .endCell();
    }
    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jetton_amount: bigint, to: Address,
        responseAddress:Address,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeBobJettonWallet.transferMessage(
                jetton_amount,
                to,
                responseAddress,
                customPayload,
                forward_ton_amount,
                forwardPayload
            ),
            value:value
        });

    }

    /*
      burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
                    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
                    = InternalMsgBody;
    */
    static burnMessage(
        jetton_amount: bigint,
        responseAddress:Address | null,
        customPayload: Cell | null
    ) {
        return beginCell()
            .storeUint(Op.burn, 32)
            .storeUint(0, 64) // op, queryId
            .storeCoins(jetton_amount).storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .endCell();
    }

    async sendBurn(provider: ContractProvider, via: Sender, value: bigint,
                          jetton_amount: bigint,
                          responseAddress:Address | null,
                          customPayload: Cell | null) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: SpongeBobJettonWallet.burnMessage(
                jetton_amount,
                responseAddress,
                customPayload
            ),
            value:value
        });

    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const balance = await provider.get('get_smc_balance', []);
        return balance.stack.readBigNumber();
    }
}
