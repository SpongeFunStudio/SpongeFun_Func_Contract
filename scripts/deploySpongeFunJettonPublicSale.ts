import { toNano } from '@ton/core';
import { SpongeFunJettonPublicSale } from '../wrappers/SpongeFunJettonPublicSale';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';

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
                    jetton_content: jettonContentToCell({uri: "https://ahmjtzedkhprhxljkapi.supabase.co/storage/v1/object/public/mini-app-public/SpongeBobCoin.json"})
                },
                await compile('SpongeFunJettonMinter')
        ));
    console.log(spongeFunJettonMinter.address)
    const spongeFunJettonPublicSale = provider.open(SpongeFunJettonPublicSale.createFromConfig({
        sponge_fun_minter_address: spongeFunJettonMinter.address,
        admin_address: adminAddress.address,
        jetton_wallet_code: jwallet_code
    }, await compile('SpongeFunJettonPublicSale')));

    await spongeFunJettonPublicSale.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeFunJettonPublicSale.address);
}
