import { toNano } from '@ton/core';
import { SpongeBobAdvertising } from '../wrappers/SpongeBobAdvertising';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';

export async function run(provider: NetworkProvider) {

    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();
    const adminAddress = await promptUserFriendlyAddress("Enter the address of the jetton owner (admin):", ui, isTestnet);
    
    const spongeBobAdvertising = provider.open(SpongeBobAdvertising.createFromConfig({
        price_perday: BigInt(10000000),
        admin_address: adminAddress.address,
    }, await compile('SpongeBobAdvertising')));

    await spongeBobAdvertising.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobAdvertising.address);

    // run methods on `spongeBobAdvertising`
}
