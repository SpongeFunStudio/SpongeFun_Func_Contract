import { Address, toNano } from '@ton/core';
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { jettonWalletCodeFromLibrary } from '../wrappers/ui-utils';

export async function run(provider: NetworkProvider) {
    
    const admin_address = Address.parse("")
    const airdrop_contract_address = Address.parse("")
    const public_sale_contract_address = Address.parse("")
    const team_contract_address = Address.parse("")
    const treasury_contract_address = Address.parse("")

    const jettonWalletCodeRaw = await compile('SpongeBobJettonWallet');
    const jettonWalletCode = jettonWalletCodeFromLibrary(jettonWalletCodeRaw);
    const jettonMetadataUri = "https://jettonowner.com/jetton.json";

    const spongeBobJettonMinter = provider.open(SpongeBobJettonMinter.createFromConfig(
        {
            max_supply: 1000000000,
            mintable: true,
            admin_address: admin_address,
            airdrop_contract_address: airdrop_contract_address,
            public_sale_contract_address: public_sale_contract_address,
            team_contract_address: team_contract_address,
            treasury_contract_address: treasury_contract_address,
            jetton_wallet_code: jettonWalletCode,
            jetton_content: {uri: jettonMetadataUri}
        },
        await compile('SpongeBobJettonMinter'))
    );

    await spongeBobJettonMinter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(spongeBobJettonMinter.address);

    // run methods on `spongeBobJettonMinter`
}
