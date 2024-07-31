import { toNano } from '@ton/core';
import { SpongeBobJettonPublicSale } from '../wrappers/SpongeBobJettonPublicSale';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';

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
                    jetton_content: jettonContentToCell({uri: "https://jettonowner.com/jetton.json"})
                },
                await compile('SpongeBobJettonMinter')
        ));
    const spongeBobJettonPublicSale = provider.open(SpongeBobJettonPublicSale.createFromConfig({
        sponge_bob_minter_address: spongeBobJettonMinter.address,
        admin_address: adminAddress.address,
        jetton_wallet_code: jwallet_code
    }, await compile('SpongeBobJettonPublicSale')));

    await spongeBobJettonPublicSale.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonPublicSale.address);
}
