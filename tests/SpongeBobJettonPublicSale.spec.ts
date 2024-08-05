import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, fromNano, toNano } from '@ton/core';
import { SpongeBobJettonPublicSale } from '../wrappers/SpongeBobJettonPublicSale';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { Errors, Op } from '../wrappers/JettonConstants';


let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
let user2: SandboxContract<TreasuryContract>;
let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;
let spongeBobAirdropContract: SandboxContract<SpongeBobJettonAirdrop>;
let spongeBobJettonPublicSale: SandboxContract<SpongeBobJettonPublicSale>;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeBobJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeBobJettonPublicSale', () => {
    let spongeBobMinterCode: Cell;
    let spongeBobAirdropCode: Cell;
    let spongeBobPublicSaleCode: Cell;
    let kp: KeyPair;

    beforeAll(async () => {
        spongeBobPublicSaleCode = await compile('SpongeBobJettonPublicSale')
        spongeBobMinterCode = await compile('SpongeBobJettonMinter');
        spongeBobAirdropCode = await compile('SpongeBobJettonAirdrop');
    });

    beforeEach(async () => {

        blockchain = await Blockchain.create();
        kp = await randomKp();
        deployer = await blockchain.treasury('deployer');
        notDeployer  = await blockchain.treasury('notDeployer');
        user = await blockchain.treasury('user');
        user2 = await blockchain.treasury('user2');

        jwallet_code = await compile('SpongeBobJettonWallet');

        spongeBobJettonMinter = blockchain.openContract(
            SpongeBobJettonMinter.createFromConfig({
                    mintable: true,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code,
                    jetton_content: jettonContentToCell({uri: "https://ton.org/"})
                },
                spongeBobMinterCode
            ));
        
        spongeBobAirdropContract = blockchain.openContract(
            SpongeBobJettonAirdrop.createFromConfig({
                    public_key: kp.publicKey,
                    sponge_bob_minter_address: spongeBobJettonMinter.address,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code
                },
            spongeBobAirdropCode
        ));

        spongeBobJettonPublicSale = blockchain.openContract(
            SpongeBobJettonPublicSale.createFromConfig({
                    sponge_bob_minter_address: spongeBobJettonMinter.address,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code,
                },
            spongeBobPublicSaleCode
        ));
        
        userWallet = async (address:Address) => blockchain.openContract(
                          SpongeBobJettonWallet.createFromAddress(
                            await spongeBobJettonMinter.getWalletAddress(address)
                          )
                     );
        await spongeBobJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeBobAirdropContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        const allTokenAmount = toNano("1000000000");
        await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeBobAirdropContract.address,
            allTokenAmount,
            null, null, null
        );

        const deployResult = await spongeBobJettonPublicSale.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobJettonPublicSale.address,
            deploy: true,
            success: true,
        });

        const claimAmount = toNano("100000000");
        for (let i = 0; i < 2; i++) {
            await spongeBobAirdropContract.sendClaimAirdropTokenMessage(
                user.getSender(),
                i,
                claimAmount,
                kp.secretKey
            );
        }
        await spongeBobAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            spongeBobJettonPublicSale.address
        );
        const publicSaleContractWallet = await userWallet(spongeBobJettonPublicSale.address);
        const publicSaleContractBalance = await publicSaleContractWallet.getJettonBalance();
        expect(publicSaleContractBalance).toEqual(toNano(700000000));
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonPublicSale are ready to use
    });

    it('should failed to buy token if public sale not start', async () => {
        const res = await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user.getSender(),
            toNano('0.07')
        );
        expect(res.transactions).toHaveTransaction({
            from: user.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.sale_not_start,
        });
    });

    it('should success to buy token if public sale start', async () => {
        const res = await spongeBobJettonPublicSale.sendStartSaleTokenMessage(
            deployer.getSender(),
            toNano('0.05')
        );
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            success: true,
        });
        expect(await spongeBobJettonPublicSale.getBStartSale()).toEqual(true);
        expect(await spongeBobJettonPublicSale.getTotalSale()).toEqual(0n);

        const userJettonWallet = await userWallet(user.address);
        const beforeBalance = await userJettonWallet.getJettonBalance();
        expect(beforeBalance).toEqual(toNano("200000000"));

        const res1 = await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user.getSender(),
            toNano('1.1')
        );
        expect(res1.transactions).toHaveTransaction({
            from: user.address,
            on: spongeBobJettonPublicSale.address,
            success: true,
        });
        const afterBalance = await userJettonWallet.getJettonBalance();
        expect(afterBalance).toEqual(beforeBalance + toNano("1") * BigInt(100000000));
    });

    it('not a admin can not send mintToTreasury message', async () => {
        const res = await spongeBobJettonPublicSale.sendMintToTreasuryMessage(
            notDeployer.getSender(),
            toNano('0.05'),
            user.address
        );
        expect(res.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('can send mintToTreasury message after sold out', async () => {
        await spongeBobJettonPublicSale.sendStartSaleTokenMessage(
            deployer.getSender(),
            toNano('0.05')
        );
        const user2JettonWallet = await userWallet(user2.address);
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        const afterBalance = await user2JettonWallet.getJettonBalance();
        expect(afterBalance).toEqual(toNano("4") * BigInt(100000000));

        const publicSaleContractWallet = await userWallet(spongeBobJettonPublicSale.address);
        const publicSaleContractBalance = await publicSaleContractWallet.getJettonBalance();
        expect(publicSaleContractBalance).toEqual(toNano("300000000"));

        expect(await spongeBobJettonPublicSale.getTotalSale()).toEqual(toNano("400000000"));

        let treasury: SandboxContract<TreasuryContract> = await blockchain.treasury('treasury');
        let treasuryWallet = await userWallet(treasury.address);
        const res = await spongeBobJettonPublicSale.sendMintToTreasuryMessage(
            deployer.getSender(),
            toNano('0.05'),
            treasury.address
        );
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            success: true
        });
        const treasuryBalance = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance).toEqual(toNano("120000000"));

        let team: SandboxContract<TreasuryContract> = await blockchain.treasury('team');
        let teamWallet = await userWallet(team.address);
        const res2 = await spongeBobJettonPublicSale.sendMintToTeamMessage(
            deployer.getSender(),
            toNano('0.05'),
            team.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            success: true
        });
        const teamBalance = await teamWallet.getJettonBalance();
        expect(teamBalance).toEqual(toNano("100000000"));

        let lp: SandboxContract<TreasuryContract> = await blockchain.treasury('lp');
        let lpWallet = await userWallet(lp.address);
        const res3 = await spongeBobJettonPublicSale.sendMintToLpMessage(
            deployer.getSender(),
            toNano('0.05'),
            lp.address
        );
        expect(res3.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            success: true
        });
        const lpBalance = await lpWallet.getJettonBalance();
        expect(lpBalance).toEqual(toNano("80000000"));
    });

    it('can not send mintToTreasury message before sold out', async () => {
        const res = await spongeBobJettonPublicSale.sendMintToTreasuryMessage(
            deployer.getSender(),
            toNano('0.05'),
            user.address
        );
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.not_sold_out,
        });
    });

    it('can not withdraw before sold out', async () => {
        const res = await spongeBobJettonPublicSale.sendWithdrawMessage(
            deployer.getSender(),
            toNano('0.05'),
            toNano('1')
        );
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.not_sold_out,
        });
    });

    it('can not withdraw if not owner', async () => {
        const res = await spongeBobJettonPublicSale.sendWithdrawMessage(
            notDeployer.getSender(),
            toNano('0.05'),
            toNano('1')
        );
        expect(res.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.not_owner,
        });
    });

    it('can not withdraw if value less than min_ton_for_storage', async () => {
        await spongeBobJettonPublicSale.sendStartSaleTokenMessage(
            deployer.getSender(),
            toNano('0.05')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );

        const res = await spongeBobJettonPublicSale.sendWithdrawMessage(deployer.getSender(), toNano('0.01'), toNano('10'));
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.balance_not_enough,
        });
    });

    it('can withdraw if use correct params', async () => {
        await spongeBobJettonPublicSale.sendStartSaleTokenMessage(
            deployer.getSender(),
            toNano('0.05')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );
        await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user2.getSender(),
            toNano('1.1')
        );

        const beforeBalance = await deployer.getBalance();
        const res = await spongeBobJettonPublicSale.sendWithdrawMessage(deployer.getSender(), toNano('0.01'), toNano('3'));
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            success: true,
        });
        const afterBalance = await deployer.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('3'));
    });

    it('admin can change admin', async () => {
        const adminBefore = await spongeBobJettonPublicSale.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let res = await spongeBobJettonPublicSale.sendChangeAdmin(deployer.getSender(), notDeployer.address);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonPublicSale.address,
            success: true
        });

	    const adminAfter = await spongeBobJettonPublicSale.getAdminAddress();
        expect(adminAfter).toEqualAddress(notDeployer.address);
        await spongeBobJettonPublicSale.sendChangeAdmin(notDeployer.getSender(), deployer.address);
        expect((await spongeBobJettonPublicSale.getAdminAddress()).equals(deployer.address)).toBe(true);
    });

    it('not a admin can not start public sale', async () => {
        const adminBefore = await spongeBobJettonPublicSale.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        const res = await spongeBobJettonPublicSale.sendStartSaleTokenMessage(
            notDeployer.getSender(),
            toNano('0.05')
        );
        expect(res.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobJettonPublicSale.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });
});
