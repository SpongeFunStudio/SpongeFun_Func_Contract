import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SpongeBob } from '../wrappers/SpongeBob';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SpongeBob', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBob');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let spongeBob: SandboxContract<SpongeBob>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        spongeBob = blockchain.openContract(
            SpongeBob.createFromConfig(
                {
                    id: 0,
                    counter: 0,
                },
                code
            )
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult = await spongeBob.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBob.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBob are ready to use
    });

    it('should increase counter', async () => {
        const increaseTimes = 3;
        for (let i = 0; i < increaseTimes; i++) {
            console.log(`increase ${i + 1}/${increaseTimes}`);

            const increaser = await blockchain.treasury('increaser' + i);

            const counterBefore = await spongeBob.getCounter();

            console.log('counter before increasing', counterBefore);

            const increaseBy = Math.floor(Math.random() * 100);

            console.log('increasing by', increaseBy);

            const increaseResult = await spongeBob.sendIncrease(increaser.getSender(), {
                increaseBy,
                value: toNano('0.05'),
            });

            expect(increaseResult.transactions).toHaveTransaction({
                from: increaser.address,
                to: spongeBob.address,
                success: true,
            });

            const counterAfter = await spongeBob.getCounter();

            console.log('counter after increasing', counterAfter);

            expect(counterAfter).toBe(counterBefore + increaseBy);
        }
    });
});
