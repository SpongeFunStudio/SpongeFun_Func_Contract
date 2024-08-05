import { toNano } from '@ton/core';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';

export async function run(provider: NetworkProvider) {
    
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    const jwallet_code = await compile('SpongeBobJettonWallet');
    const adminAddress = await promptUserFriendlyAddress("Enter the address of the jetton owner (admin):", ui, isTestnet);

    const spongeBobJettonMinter = provider.open(
            SpongeBobJettonMinter.createFromConfig({
                    mintable: true,
                    admin_address: adminAddress.address,
                    jetton_wallet_code: jwallet_code,
                    jetton_content: jettonContentToCell({uri: "https://ygytkyoysropdzezabwz.supabase.co/storage/v1/object/public/mini-app-public/SpongeBobCoin.json"})
                },
                await compile('SpongeBobJettonMinter')
        ));

    await spongeBobJettonMinter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonMinter.address);

    // run methods on `spongeBobJettonMinter`
}
