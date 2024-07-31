import { toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import { compile, NetworkProvider } from '@ton/blueprint';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';
import * as dotenv from 'dotenv'
dotenv.config()

async function getKp() {
    let mnemonics = process.env.MNEMONICS ? process.env.MNEMONICS.split(' ') : await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    const jwallet_code = await compile('SpongeBobJettonWallet');
    let kp: KeyPair = await getKp();

    const adminAddress = await promptUserFriendlyAddress("Enter the address of the jetton owner (admin):", ui, isTestnet);

    const spongeBobJettonMinter = provider.open(
            SpongeBobJettonMinter.createFromConfig({
                    mintable: true,
                    admin_address: adminAddress.address,
                    jetton_wallet_code: jwallet_code,
                    jetton_content: jettonContentToCell({uri: "https://jettonowner.com/jetton.json"})
                },
                await compile('SpongeBobJettonMinter')
        ));
    
    const spongeBobJettonAirdrop = provider.open(SpongeBobJettonAirdrop.createFromConfig({
        public_key: kp.publicKey,
        sponge_bob_minter_address: spongeBobJettonMinter.address,
        admin_address: adminAddress.address,
        jetton_wallet_code: jwallet_code
    }, await compile('SpongeBobJettonAirdrop')));

    await spongeBobJettonAirdrop.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonAirdrop.address);

    // run methods on `spongeBobJettonAirdrop`
}
