import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import * as dotenv from 'dotenv'
import { SpongeBobJettonPublicSale } from '../wrappers/SpongeBobJettonPublicSale';
dotenv.config()

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const publicSaleContractAddress = Address.parse('EQBJng9IbS3-7wNtL2stCZA8SdqsdFrkn49jVqrrSRvLGAf5');
    const jettonAirdropAddress = Address.parse('EQA1SlXAI8ZFKkBuKCIocdwy0MR76y8i66yCP9CGBhB7pIFb');

    try {
        const spongeBobJettonAirdrop = provider.open(
            SpongeBobJettonAirdrop.createFromAddress(jettonAirdropAddress)
        );

        const res = await spongeBobJettonAirdrop.getAirdropStatus();
        console.log(res);

        const claimValue = toNano("100000000");
        await spongeBobJettonAirdrop.sendMintToPublicSaleContractMessage(
            provider.sender(),
            publicSaleContractAddress,
        )
        ui.write('Send token to public_sale contract');

        const spongeBobJettonPublicSale = provider.open(
            SpongeBobJettonPublicSale.createFromAddress(publicSaleContractAddress)
        );
        await spongeBobJettonPublicSale.sendStartSaleTokenMessage(provider.sender(),toNano("0.05"));
        ui.write('Open sale');

    } catch (e: any) {
        ui.write(e.message);
        return;
    }
}
