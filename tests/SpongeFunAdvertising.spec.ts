import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeFunAdvertising } from '../wrappers/SpongeFunAdvertising';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';


let spongeFunJettonMinter: SandboxContract<SpongeFunJettonMinter>;

describe('SpongeFunAdvertising', () => {
    let SpongeFunAdvertisingCode: Cell;
    let spongeFunMinterCode: Cell;

    beforeAll(async () => {
        spongeFunMinterCode = await compile('SpongeFunJettonMinter');
        SpongeFunAdvertisingCode = await compile('SpongeFunAdvertising');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeFunAdvertising: SandboxContract<SpongeFunAdvertising>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        
        let jwallet_code = await compile('SpongeFunJettonWallet');

        spongeFunJettonMinter = blockchain.openContract(
            SpongeFunJettonMinter.createFromConfig({
                    mintable: true,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code,
                    jetton_content: jettonContentToCell({uri: "https://ton.org/"})
                },
                spongeFunMinterCode
            ));
        
        spongeFunAdvertising = blockchain.openContract(SpongeFunAdvertising.createFromConfig({
            price_perday: BigInt(10000000),
            sponge_price_perday: BigInt(10000000),
            admin_address: deployer.address,
            sponge_fun_minter_address: spongeFunJettonMinter.address,
            jetton_wallet_code: jwallet_code,
        }, SpongeFunAdvertisingCode));

        const deployResult = await spongeFunAdvertising.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeFunAdvertising.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeFunAdvertising are ready to use
    });
});
