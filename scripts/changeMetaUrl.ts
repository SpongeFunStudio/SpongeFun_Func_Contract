import { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';
import * as dotenv from 'dotenv'
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
dotenv.config()

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const jettonMinterContractAddress = Address.parse('EQCv7QtKCd_FhoJ3iF3R9V9Q6V1NmvoAdMKVee2NNxue0jGO');
    const jettonMetadataUri = "https://ygytkyoysropdzezabwz.supabase.co/storage/v1/object/public/mini-app-public/SpongeBobCoin.json"

    try {
        const spongeBobJettonMinter = provider.open(
            SpongeBobJettonMinter.createFromAddress(jettonMinterContractAddress)
        );

        await spongeBobJettonMinter.sendChangeContent(
            provider.sender(),
            {
                uri: jettonMetadataUri
            },
        )
        ui.write('sendChangeContent tx send');

    } catch (e: any) {
        ui.write(e.message);
        return;
    }
}
