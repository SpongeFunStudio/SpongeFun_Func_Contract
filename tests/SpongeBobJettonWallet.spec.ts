import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SpongeBobJettonWallet', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBobJettonWallet');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeBobJettonWallet: SandboxContract<SpongeBobJettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        spongeBobJettonWallet = blockchain.openContract(SpongeBobJettonWallet.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await spongeBobJettonWallet.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobJettonWallet.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonWallet are ready to use
    });
});
