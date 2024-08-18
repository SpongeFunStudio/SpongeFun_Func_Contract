import { NetworkProvider } from '@ton/blueprint';
import { SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {

    const ui = provider.ui();
    const jettonMinterAddress = Address.parse('EQAg9J1EYrCn4fckJGXBZcKSEnEydQv06Q7GalZbmXY0TSpc');

    try {
        const spongeFunJettonMinter = provider.open(
            SpongeFunJettonMinter.createFromAddress(jettonMinterAddress)
        );

        const airdropValue = toNano("1000000000");
        await spongeFunJettonMinter.sendMintToClaimAirdropMessage(
            provider.sender(),
            Address.parse('EQCBh5eBs7I7vu3dhOvRWGTuToOprvZSi6agfvQnhePke72i'),
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
