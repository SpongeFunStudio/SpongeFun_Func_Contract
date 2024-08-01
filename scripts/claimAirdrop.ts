import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import * as dotenv from 'dotenv'
dotenv.config()

async function getKp() {
    let mnemonics = process.env.MNEMONICS ? process.env.MNEMONICS.split(' ') : await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const jettonAirdropAddress = Address.parse('EQBOf-KRgE3chy41JasoAFlELSxJq78mNLwbkhGYD5bmaRQP');

    try {
        const spongeBobJettonAirdrop = provider.open(
            SpongeBobJettonAirdrop.createFromAddress(jettonAirdropAddress)
        );

        const claimValue = toNano("10000");
        await spongeBobJettonAirdrop.sendClaimAirdropTokenMessage(
            provider.sender(),
            parseInt((new Date().getTime() / 1000 ).toFixed(0)),
            claimValue,
            (await getKp()).secretKey
        );
        ui.write('Transaction sent');

    } catch (e: any) {
        ui.write(e.message);
        return;
    }
}
