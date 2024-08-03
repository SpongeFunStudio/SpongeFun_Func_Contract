import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeBobJettonVestingLockup } from '../wrappers/SpongeBobJettonVestingLockup';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SpongeBobJettonVestingLockup', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBobJettonVestingLockup');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeBobJettonVestingLockup: SandboxContract<SpongeBobJettonVestingLockup>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        spongeBobJettonVestingLockup = blockchain.openContract(SpongeBobJettonVestingLockup.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await spongeBobJettonVestingLockup.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobJettonVestingLockup.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonVestingLockup are ready to use
    });
});
