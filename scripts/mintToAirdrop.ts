import { NetworkProvider } from '@ton/blueprint';
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {

    const ui = provider.ui();
    const jettonMinterAddress = Address.parse('EQAPYZ_WF9dXF7v1lraTU2YkfRwgl7hQE2DvcajTFpUU2xDC');

    try {
        const spongeBobJettonMinter = provider.open(
            SpongeBobJettonMinter.createFromAddress(jettonMinterAddress)
        );

        const airdropValue = toNano("1000000000");
        await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            provider.sender(),
            Address.parse('EQBOf-KRgE3chy41JasoAFlELSxJq78mNLwbkhGYD5bmaRQP'),
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
