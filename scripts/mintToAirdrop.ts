import { NetworkProvider } from '@ton/blueprint';
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {

    const ui = provider.ui();
    const jettonMinterAddress = Address.parse('EQC18jYPxvFhsp_4FHI_NVm0xOiQBeDE3QOpgFhihr-Fv3C0');

    try {
        const spongeBobJettonMinter = provider.open(
            SpongeBobJettonMinter.createFromAddress(jettonMinterAddress)
        );

        const airdropValue = toNano("1000000000");
        await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            provider.sender(),
            Address.parse('EQA-sgX9fp9ck8rKmgUETVVFWRJh6Ux6zqhvHGwMy4QysCgb'),
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
