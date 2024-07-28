import { toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const spongeBobJettonAirdrop = provider.open(SpongeBobJettonAirdrop.createFromConfig({}, await compile('SpongeBobJettonAirdrop')));

    await spongeBobJettonAirdrop.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonAirdrop.address);

    // run methods on `spongeBobJettonAirdrop`
}
