import { toNano } from '@ton/core';
import { SpongeFunJettonVestingLockup } from '../wrappers/SpongeFunJettonVestingLockup';
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
    
    const spongeFunJettonVestingLockup = provider.open(SpongeFunJettonVestingLockup.createFromConfig({
        sponge_fun_minter_address: spongeFunJettonMinter.address,
        admin_address: adminAddress.address,
        total_lock_amount: BigInt(1000000000),
        start_time: BigInt(Date.now() / 1000),
        total_duration: 1000,
        unlock_period: 100,
        cliff_duration: 100,
        jetton_wallet_code: jwallet_code
    }, await compile('SpongeFunJettonVestingLockup')));

    await spongeFunJettonVestingLockup.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeFunJettonVestingLockup.address);

    // run methods on `spongeFunJettonVestingLockup`
}
