import { toNano } from '@ton/core';
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const spongeBobJettonMinter = provider.open(SpongeBobJettonMinter.createFromConfig({}, await compile('SpongeBobJettonMinter')));

    await spongeBobJettonMinter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonMinter.address);

    // run methods on `spongeBobJettonMinter`
}
