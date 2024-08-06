import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeBobAdvertising } from '../wrappers/SpongeBobAdvertising';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell } from '../wrappers/SpongeBobJettonMinter';

describe('SpongeBobAdvertising', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBobAdvertising');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeBobAdvertising: SandboxContract<SpongeBobAdvertising>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        spongeBobAdvertising = blockchain.openContract(SpongeBobAdvertising.createFromConfig({
            price_perday: toNano('1'),
            admin_address: deployer.address
        }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await spongeBobAdvertising.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobAdvertising.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobAdvertising are ready to use
    });
});
