import { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';
import * as dotenv from 'dotenv'
import { SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';
dotenv.config()

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const jettonMinterContractAddress = Address.parse('EQCv7QtKCd_FhoJ3iF3R9V9Q6V1NmvoAdMKVee2NNxue0jGO');
    const jettonMetadataUri = "https://ygytkyoysropdzezabwz.supabase.co/storage/v1/object/public/mini-app-public/SpongeFunCoin.json"

    try {
        const spongeFunJettonMinter = provider.open(
            SpongeFunJettonMinter.createFromAddress(jettonMinterContractAddress)
        );

        await spongeFunJettonMinter.sendChangeContent(
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
