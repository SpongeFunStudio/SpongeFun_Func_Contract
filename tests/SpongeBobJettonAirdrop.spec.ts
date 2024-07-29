import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SpongeBobJettonAirdrop', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBobJettonAirdrop');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeBobJettonAirdrop: SandboxContract<SpongeBobJettonAirdrop>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // spongeBobJettonAirdrop = blockchain.openContract(SpongeBobJettonAirdrop.createFromConfig({}, code));

        // deployer = await blockchain.treasury('deployer');

        // const deployResult = await spongeBobJettonAirdrop.sendDeploy(deployer.getSender(), toNano('0.05'));

        // expect(deployResult.transactions).toHaveTransaction({
        //     from: deployer.address,
        //     to: spongeBobJettonAirdrop.address,
        //     deploy: true,
        //     success: true,
        // });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonAirdrop are ready to use
    });
});
