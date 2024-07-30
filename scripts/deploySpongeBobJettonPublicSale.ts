import { toNano } from '@ton/core';
import { SpongeBobJettonPublicSale } from '../wrappers/SpongeBobJettonPublicSale';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const spongeBobJettonPublicSale = provider.open(SpongeBobJettonPublicSale.createFromConfig({}, await compile('SpongeBobJettonPublicSale')));

    await spongeBobJettonPublicSale.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonPublicSale.address);

    // run methods on `spongeBobJettonPublicSale`
}
