import { toNano } from '@ton/core';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';

export async function run(provider: NetworkProvider) {
    
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    const jwallet_code = await compile('SpongeFunJettonWallet');
    const adminAddress = await promptUserFriendlyAddress("Enter the address of the jetton owner (admin):", ui, isTestnet);

    const spongeFunJettonMinter = provider.open(
            SpongeFunJettonMinter.createFromConfig({
                    mintable: true,
                    admin_address: adminAddress.address,
                    jetton_wallet_code: jwallet_code,
                    jetton_content: jettonContentToCell({uri: "https://ygytkyoysropdzezabwz.supabase.co/storage/v1/object/public/mini-app-public/SpongeFunCoin.json"})
                },
                await compile('SpongeFunJettonMinter')
        ));

    await spongeFunJettonMinter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeFunJettonMinter.address);

    // run methods on `spongeFunJettonMinter`
}
