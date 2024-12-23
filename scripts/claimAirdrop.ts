import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { SpongeFunJettonAirdrop } from '../wrappers/SpongeFunJettonAirdrop';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import * as dotenv from 'dotenv'
dotenv.config()

async function getKp() {
    let mnemonics = process.env.MNEMONICS ? process.env.MNEMONICS.split(' ') : await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const jettonAirdropAddress = Address.parse('EQA1SlXAI8ZFKkBuKCIocdwy0MR76y8i66yCP9CGBhB7pIFb');

    try {
        const spongeFunJettonAirdrop = provider.open(
            SpongeFunJettonAirdrop.createFromAddress(jettonAirdropAddress)
        );

        const claimValue = toNano("100000000");
        await spongeFunJettonAirdrop.sendClaimAirdropTokenMessage(
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
