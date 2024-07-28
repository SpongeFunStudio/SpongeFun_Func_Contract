import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SpongeBobJettonMinter', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBobJettonMinter');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        spongeBobJettonMinter = blockchain.openContract(SpongeBobJettonMinter.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await spongeBobJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobJettonMinter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonMinter are ready to use
    });
});
