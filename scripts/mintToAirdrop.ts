import { NetworkProvider } from '@ton/blueprint';
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {

    const ui = provider.ui();
    const jettonMinterAddress = Address.parse('EQCv7QtKCd_FhoJ3iF3R9V9Q6V1NmvoAdMKVee2NNxue0jGO');

    try {
        const spongeBobJettonMinter = provider.open(
            SpongeBobJettonMinter.createFromAddress(jettonMinterAddress)
        );

        const airdropValue = toNano("1000000000");
        await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            provider.sender(),
            Address.parse('EQA1SlXAI8ZFKkBuKCIocdwy0MR76y8i66yCP9CGBhB7pIFb'),
            airdropValue,
            null,
            provider.sender().address
        );
        ui.write('Transaction sent');

    } catch (e: any) {
        ui.write(e.message);
        return;
    }
}
