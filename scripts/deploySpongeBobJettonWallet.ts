import { toNano } from '@ton/core';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const spongeBobJettonWallet = provider.open(SpongeBobJettonWallet.createFromConfig({}, await compile('SpongeBobJettonWallet')));

    await spongeBobJettonWallet.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonWallet.address);

    // run methods on `spongeBobJettonWallet`
}
