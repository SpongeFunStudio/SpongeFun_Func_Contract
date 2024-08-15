import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { SpongeFunJettonAirdrop } from '../wrappers/SpongeFunJettonAirdrop';
import * as dotenv from 'dotenv'
import { SpongeFunJettonPublicSale } from '../wrappers/SpongeFunJettonPublicSale';
dotenv.config()

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const publicSaleContractAddress = Address.parse('EQBJng9IbS3-7wNtL2stCZA8SdqsdFrkn49jVqrrSRvLGAf5');
    const jettonAirdropAddress = Address.parse('EQA1SlXAI8ZFKkBuKCIocdwy0MR76y8i66yCP9CGBhB7pIFb');

    try {
        const spongeFunJettonAirdrop = provider.open(
            SpongeFunJettonAirdrop.createFromAddress(jettonAirdropAddress)
        );

        const res = await spongeFunJettonAirdrop.getAirdropStatus();
        console.log(res);

        await spongeFunJettonAirdrop.sendMintToPublicSaleContractMessage(
            provider.sender(),
            publicSaleContractAddress,
        )
        ui.write('Send token to public_sale contract');

        const spongeFunJettonPublicSale = provider.open(
            SpongeFunJettonPublicSale.createFromAddress(publicSaleContractAddress)
        );
        await spongeFunJettonPublicSale.sendStartSaleTokenMessage(provider.sender(),toNano("0.05"));
        ui.write('Open sale');

    } catch (e: any) {
        ui.write(e.message);
        return;
    }
}
