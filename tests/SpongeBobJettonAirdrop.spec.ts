import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { Errors, Op } from '../wrappers/JettonConstants';

let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
let public_sale_contract: SandboxContract<TreasuryContract>;
let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;
let spongeBobAirdropContract: SandboxContract<SpongeBobJettonAirdrop>;
let spongeBobWalletContract: SandboxContract<SpongeBobJettonWallet>;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeBobJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeBobJettonAirdrop', () => {
    let spongeBobMinterCode: Cell;
    let spongeBobAirdropCode: Cell;
    let kp: KeyPair;

    beforeAll(async () => {
        spongeBobMinterCode = await compile('SpongeBobJettonMinter');
        spongeBobAirdropCode = await compile('SpongeBobJettonAirdrop');
    });

    beforeEach(async () => {

        blockchain = await Blockchain.create();
        kp = await randomKp();
        deployer = await blockchain.treasury('deployer');
        notDeployer  = await blockchain.treasury('notDeployer');
        user = await blockchain.treasury('user');
        public_sale_contract = await blockchain.treasury('public_sale_contract');

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

        userWallet = async (address:Address) => blockchain.openContract(
                          SpongeBobJettonWallet.createFromAddress(
                            await spongeBobJettonMinter.getWalletAddress(address)
                          )
                     );

        const deployResult = await spongeBobJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobJettonMinter.address,
            deploy: true,
            success: true,
        });

        // Make sure it didn't bounce
        expect(deployResult.transactions).not.toHaveTransaction({
            on: deployer.address,
            from: spongeBobJettonMinter.address,
            inMessageBounced: true
        });

        const deployResult1 = await spongeBobAirdropContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult1.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobAirdropContract.address,
            deploy: true,
            success: true,
        });

        //mint dirdrop token to airdrop contract
        const allTokenAmount = toNano("1000000000");
        let initialTotalSupply = await spongeBobJettonMinter.getTotalSupply();

        const airdropWalletJettonWallet = await userWallet(spongeBobAirdropContract.address);
        const res = await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeBobAirdropContract.address,
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
        expect(await spongeBobJettonMinter.getTotalSupply()).toEqual(initialTotalSupply + allTokenAmount);

        spongeBobWalletContract = blockchain.openContract(
            SpongeBobJettonWallet.createFromAddress(airdropWalletJettonWallet.address)
        );
        const walletData = await spongeBobWalletContract.getWalletData();
        expect(walletData.owner.equals(spongeBobAirdropContract.address));
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonAirdrop are ready to use
    });

    it('should claim token successful if have right signature', async () => {
        const claimAmount = toNano("1000");
        const userJettonWallet = await userWallet(user.address);
        const res0 = await spongeBobAirdropContract.getAirdropStatus();
        expect(res0.total_claimed).toEqual(0n);

        const res = await spongeBobAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            0,
            claimAmount,
            kp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeBobAirdropContract.address,
            success: true,
        });

        const curBalance = await userJettonWallet.getJettonBalance();
        expect(curBalance).toEqual(claimAmount);
        const res1 = await spongeBobAirdropContract.getAirdropStatus();
        expect(res1.total_claimed).toEqual(res0.total_claimed + claimAmount);
    });

    it('should failed to mint_to_public_sale_contract before 1/2 airdrop token be claimed', async () => {
        const res2 = await spongeBobAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            public_sale_contract.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobAirdropContract.address,
            aborted: true,
            exitCode: Errors.can_not_start_public_sale,
        });
    });

    it('Failed to mint_to_public_sale_contract if not admin', async () => {
        const res2 = await spongeBobAirdropContract.sendMintToPublicSaleContractMessage(
            notDeployer.getSender(),
            public_sale_contract.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobAirdropContract.address,
            aborted: true,
            exitCode: Errors.not_owner,
        });
    });

    it('should success to mint_to_public_sale_contract after 1/2 airdrop token be claimed', async () => {
        const claimAmount = toNano("300000000");
        const userJettonWallet = await userWallet(user.address);
        const res0 = await spongeBobAirdropContract.getAirdropStatus();
        expect(res0.total_claimed).toEqual(0n);
        const res = await spongeBobAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            0,
            claimAmount,
            kp.secretKey
        );
        expect(res.transactions).toHaveTransaction({
            on: spongeBobAirdropContract.address,
            success: true,
        });

        const curBalance = await userJettonWallet.getJettonBalance();
        expect(curBalance).toEqual(claimAmount);
        const res1 = await spongeBobAirdropContract.getAirdropStatus();
        expect(res1.total_claimed).toEqual(res0.total_claimed + claimAmount);

        const res2 = await spongeBobAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            public_sale_contract.address
        );
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobAirdropContract.address,
            success: true,
        });
        const publicSaleContractWallet = await userWallet(public_sale_contract.address);
        const publicSaleContractBalance = await publicSaleContractWallet.getJettonBalance();
        expect(publicSaleContractBalance).toEqual(toNano(650000000));
    });

    it('minter admin can change admin', async () => {
        const adminBefore = await spongeBobAirdropContract.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let res = await spongeBobAirdropContract.sendChangeAdmin(deployer.getSender(), notDeployer.address);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobAirdropContract.address,
            success: true
        });

	    const adminAfter = await spongeBobAirdropContract.getAdminAddress();
        expect(adminAfter).toEqualAddress(notDeployer.address);
        await spongeBobAirdropContract.sendChangeAdmin(notDeployer.getSender(), deployer.address);
        expect((await spongeBobAirdropContract.getAdminAddress()).equals(deployer.address)).toBe(true);
    });

    it('not a minter admin can not change admin', async () => {
        const adminBefore = await spongeBobAirdropContract.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let changeAdmin = await spongeBobAirdropContract.sendChangeAdmin(notDeployer.getSender(), notDeployer.address);
        expect((await spongeBobAirdropContract.getAdminAddress()).equals(deployer.address)).toBe(true);
        expect(changeAdmin.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobAirdropContract.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('anyone can top up', async () => {
        const beforeBalance = await spongeBobAirdropContract.getBalance();

        let topUpTx = await spongeBobAirdropContract.sendTopUp(notDeployer.getSender());
        expect(topUpTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobAirdropContract.address,
            success: true
        });
        const afterBalance = await spongeBobAirdropContract.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('1'));
    });
});
