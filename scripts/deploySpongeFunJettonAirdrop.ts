import { toNano } from '@ton/core';
import { SpongeFunJettonAirdrop } from '../wrappers/SpongeFunJettonAirdrop';
import { compile, NetworkProvider } from '@ton/blueprint';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';
import { promptUserFriendlyAddress } from '../wrappers/ui-utils';
import * as dotenv from 'dotenv'
import { exit } from 'process';
dotenv.config()

async function getKp() {
    if (!process.env.MNEMONICS) {
        exit(1)
    }
    let mnemonics = process.env.MNEMONICS.split(' ');
    return mnemonicToPrivateKey(mnemonics);
}

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    const jwallet_code = await compile('SpongeFunJettonWallet');
    let kp: KeyPair = await getKp();

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
    
    const spongeFunJettonAirdrop = provider.open(SpongeFunJettonAirdrop.createFromConfig({
        public_key: kp.publicKey,
        sponge_fun_minter_address: spongeFunJettonMinter.address,
        admin_address: adminAddress.address,
        jetton_wallet_code: jwallet_code
    }, await compile('SpongeFunJettonAirdrop')));

    await spongeFunJettonAirdrop.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeFunJettonAirdrop.address);

    // run methods on `spongeFunJettonAirdrop`
}
