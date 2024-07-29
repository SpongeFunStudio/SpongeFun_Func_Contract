import { toNano } from '@ton/core';
import { SpongeBob } from '../wrappers/SpongeBob';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {

    const jettonWalletCodeRaw = await compile('JettonWallet');
    
    const spongeBob = provider.open(
        SpongeBob.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('SpongeBob')
        )
    );

    await spongeBob.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBob.address);

    console.log('ID', await spongeBob.getID());
}
