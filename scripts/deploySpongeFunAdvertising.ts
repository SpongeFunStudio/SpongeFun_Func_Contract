import { toNano } from '@ton/core';
import { SpongeFunAdvertising } from '../wrappers/SpongeFunAdvertising';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';

// price_perday: bigint;
//     sponge_price_perday: bigint;
//     admin_address: Address;
//     sponge_fun_minter_address: Address;
//     jetton_wallet_code: Cell;
//     ad_cell?: Cell;
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
    
    const spongeFunAdvertising = provider.open(SpongeFunAdvertising.createFromConfig({
        price_perday: BigInt(10000000),
        sponge_price_perday: BigInt(10000000),
        admin_address: adminAddress.address,
        sponge_fun_minter_address: spongeFunJettonMinter.address,
        jetton_wallet_code: jwallet_code,
    }, await compile('SpongeFunAdvertising')));

    await spongeFunAdvertising.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeFunAdvertising.address);

    // run methods on `spongeFunAdvertising`
}
