import { toNano } from '@ton/core';
import { SpongeBobJettonVestingLockup } from '../wrappers/SpongeBobJettonVestingLockup';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const spongeBobJettonVestingLockup = provider.open(SpongeBobJettonVestingLockup.createFromConfig({}, await compile('SpongeBobJettonVestingLockup')));

    await spongeBobJettonVestingLockup.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonVestingLockup.address);

    // run methods on `spongeBobJettonVestingLockup`
}
