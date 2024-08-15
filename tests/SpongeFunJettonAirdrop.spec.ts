import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { SpongeFunJettonAirdrop } from '../wrappers/SpongeFunJettonAirdrop';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';
import { SpongeFunJettonWallet } from '../wrappers/SpongeFunJettonWallet';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { Errors, Op } from '../wrappers/JettonConstants';

let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
let public_sale_contract: SandboxContract<TreasuryContract>;
let spongeFunJettonMinter: SandboxContract<SpongeFunJettonMinter>;
let spongeFunAirdropContract: SandboxContract<SpongeFunJettonAirdrop>;
let spongeFunWalletContract: SandboxContract<SpongeFunJettonWallet>;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeFunJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeFunJettonAirdrop', () => {
    let spongeFunMinterCode: Cell;
    let spongeFunAirdropCode: Cell;
    let kp: KeyPair;

    beforeAll(async () => {
        spongeFunMinterCode = await compile('SpongeFunJettonMinter');
        spongeFunAirdropCode = await compile('SpongeFunJettonAirdrop');
    });

    beforeEach(async () => {

        blockchain = await Blockchain.create();
        kp = await randomKp();
        deployer = await blockchain.treasury('deployer');
        notDeployer  = await blockchain.treasury('notDeployer');
        user = await blockchain.treasury('user');
        public_sale_contract = await blockchain.treasury('public_sale_contract');

        jwallet_code = await compile('SpongeFunJettonWallet');

        spongeFunJettonMinter = blockchain.openContract(
            SpongeFunJettonMinter.createFromConfig({
                    mintable: true,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code,
                    jetton_content: jettonContentToCell({uri: "https://ton.org/"})
                },
                spongeFunMinterCode
            ));
        
        spongeFunAirdropContract = blockchain.openContract(
            SpongeFunJettonAirdrop.createFromConfig({
                    public_key: kp.publicKey,
                    sponge_fun_minter_address: spongeFunJettonMinter.address,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code
                },
                spongeFunAirdropCode
            ));

        userWallet = async (address:Address) => blockchain.openContract(
                          SpongeFunJettonWallet.createFromAddress(
                            await spongeFunJettonMinter.getWalletAddress(address)
                          )
                     );

        const deployResult = await spongeFunJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeFunJettonMinter.address,
            deploy: true,
            success: true,
        });

        // Make sure it didn't bounce
        expect(deployResult.transactions).not.toHaveTransaction({
            on: deployer.address,
            from: spongeFunJettonMinter.address,
            inMessageBounced: true
        });

        const deployResult1 = await spongeFunAirdropContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult1.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeFunAirdropContract.address,
            deploy: true,
            success: true,
        });

        //mint dirdrop token to airdrop contract
        const allTokenAmount = toNano("1000000000");
        let initialTotalSupply = await spongeFunJettonMinter.getTotalSupply();

        const airdropWalletJettonWallet = await userWallet(spongeFunAirdropContract.address);
        const res = await spongeFunJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeFunAirdropContract.address,
            allTokenAmount,
            null, null, null
        );
        expect(res.transactions).toHaveTransaction({
            on: airdropWalletJettonWallet.address,
            op: Op.internal_transfer,
            success: true,
        });
        const curBalance = await airdropWalletJettonWallet.getJettonBalance();
        expect(curBalance).toEqual(allTokenAmount);
        expect(await spongeFunJettonMinter.getTotalSupply()).toEqual(initialTotalSupply + allTokenAmount);

        spongeFunWalletContract = blockchain.openContract(
            SpongeFunJettonWallet.createFromAddress(airdropWalletJettonWallet.address)
        );
        const walletData = await spongeFunWalletContract.getWalletData();
        expect(walletData.owner.equals(spongeFunAirdropContract.address));
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeFunJettonAirdrop are ready to use
    });

    it('should claim token successful if have right signature', async () => {
        const claimAmount = toNano("1000");
        const userJettonWallet = await userWallet(user.address);
        const res0 = await spongeFunAirdropContract.getAirdropStatus();
        expect(res0.total_claimed).toEqual(0n);

        const res = await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            0,
            claimAmount,
            kp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeFunAirdropContract.address,
            success: true,
        });

        const curBalance = await userJettonWallet.getJettonBalance();
        expect(curBalance).toEqual(claimAmount);
        const res1 = await spongeFunAirdropContract.getAirdropStatus();
        expect(res1.total_claimed).toEqual(res0.total_claimed + claimAmount);
    });

    it('should failed to claim token if use error signature', async () => {
        const claimAmount = toNano("1000");
        const res0 = await spongeFunAirdropContract.getAirdropStatus();
        expect(res0.total_claimed).toEqual(0n);
        let fakekp = await randomKp();

        const res = await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            100,
            claimAmount,
            fakekp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.invalid_signature,
        });
    });

    it('should failed to claim token if use signature twice', async () => {
        const claimAmount = toNano("1000");
        await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            12378,
            claimAmount,
            kp.secretKey
        );
        const res = await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            12378,
            claimAmount,
            kp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.repeat_signature,
        });
    });

    it('should failed to claim token of claimed amout more than 10% of max supply', async () => {
        const claimAmount = toNano("300000000");
        const res = await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            0,
            claimAmount,
            kp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.exceed_max_claim_amount,
        });
    });

    it('should failed to claim token if claim out', async () => {
        const claimAmount = toNano("100000000");
        await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            0,
            claimAmount,
            kp.secretKey
        );
        await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            1,
            claimAmount,
            kp.secretKey
        );
        await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            2,
            claimAmount,
            kp.secretKey
        );
        const claimAmount1 = toNano("50000000");
        await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            3,
            claimAmount1,
            kp.secretKey
        );
        let res = await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            4,
            claimAmount1,
            kp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.claim_out,
        });
    });

    it('should failed to mint_to_public_sale_contract before 1/2 airdrop token be claimed', async () => {
        const res2 = await spongeFunAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            public_sale_contract.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.can_not_start_public_sale,
        });
    });

    it('Failed to mint_to_public_sale_contract if not admin', async () => {
        const res2 = await spongeFunAirdropContract.sendMintToPublicSaleContractMessage(
            notDeployer.getSender(),
            public_sale_contract.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.not_owner,
        });
    });

    it('should success to mint_to_public_sale_contract after 1/2 airdrop token be claimed', async () => {
        const claimAmount = toNano("100000000");
        const userJettonWallet = await userWallet(user.address);
        const res0 = await spongeFunAirdropContract.getAirdropStatus();
        expect(res0.total_claimed).toEqual(0n);

        for (let i = 0; i < 2; i++) {
            const res = await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
                user.getSender(),
                i,
                claimAmount,
                kp.secretKey
            );
            expect(res.transactions).toHaveTransaction({
                on: spongeFunAirdropContract.address,
                success: true,
            });

            const curBalance = await userJettonWallet.getJettonBalance();
            expect(curBalance).toEqual(claimAmount * BigInt(i+1));
            const res1 = await spongeFunAirdropContract.getAirdropStatus();
            expect(res1.total_claimed).toEqual(BigInt(i+1) * claimAmount);
        }

        const res2 = await spongeFunAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            public_sale_contract.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunAirdropContract.address,
            success: true,
        });
        const publicSaleContractWallet = await userWallet(public_sale_contract.address);
        const publicSaleContractBalance = await publicSaleContractWallet.getJettonBalance();
        expect(publicSaleContractBalance).toEqual(toNano(700000000));
    });

    it('minter admin can change admin', async () => {
        const adminBefore = await spongeFunAirdropContract.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let res = await spongeFunAirdropContract.sendChangeAdmin(deployer.getSender(), notDeployer.address);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunAirdropContract.address,
            success: true
        });

	    const adminAfter = await spongeFunAirdropContract.getAdminAddress();
        expect(adminAfter).toEqualAddress(notDeployer.address);
        await spongeFunAirdropContract.sendChangeAdmin(notDeployer.getSender(), deployer.address);
        expect((await spongeFunAirdropContract.getAdminAddress()).equals(deployer.address)).toBe(true);
    });

    it('not a minter admin can not change admin', async () => {
        const adminBefore = await spongeFunAirdropContract.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let changeAdmin = await spongeFunAirdropContract.sendChangeAdmin(notDeployer.getSender(), notDeployer.address);
        expect((await spongeFunAirdropContract.getAdminAddress()).equals(deployer.address)).toBe(true);
        expect(changeAdmin.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('anyone can top up', async () => {
        const beforeBalance = await spongeFunAirdropContract.getBalance();

        let topUpTx = await spongeFunAirdropContract.sendTopUp(notDeployer.getSender());
        expect(topUpTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunAirdropContract.address,
            success: true
        });
        const afterBalance = await spongeFunAirdropContract.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('0.05'));
    });

    it('can not withdraw if not admin', async () => {
        const beforeBalance = await spongeFunAirdropContract.getBalance();

        let topUpTx = await spongeFunAirdropContract.sendTopUp(notDeployer.getSender(), toNano('10'));
        expect(topUpTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunAirdropContract.address,
            success: true
        });
        const afterBalance = await spongeFunAirdropContract.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('10'));
        let withdrawTx = await spongeFunAirdropContract.sendWithdraw(notDeployer.getSender(), toNano('10'));
        expect(withdrawTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunAirdropContract.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('can withdraw success if admin', async () => {
        const beforeBalance = await spongeFunAirdropContract.getBalance();

        let topUpTx = await spongeFunAirdropContract.sendTopUp(notDeployer.getSender(), toNano('10'));
        expect(topUpTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunAirdropContract.address,
            success: true
        });
        const afterBalance = await spongeFunAirdropContract.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('10'));

        const deployerBeforeBalance = await deployer.getBalance();
        let withdrawTx = await spongeFunAirdropContract.sendWithdraw(deployer.getSender(), toNano('10'));
        expect(withdrawTx.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunAirdropContract.address,
            success: true,
        });
        const deployerAfterBalance = await deployer.getBalance();
        expect(deployerAfterBalance).toBeGreaterThan(deployerBeforeBalance + toNano('9.8'));
    });
});
