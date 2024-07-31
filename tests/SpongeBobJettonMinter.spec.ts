import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell, storeStateInit, toNano } from '@ton/core';
import { SpongeBobJettonMinter, jettonContentToCell } from '../wrappers/SpongeBobJettonMinter';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { Errors, Op } from '../wrappers/JettonConstants';
import { mnemonicNew, sign, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';

let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;
let spongeBobAirdropContract: SandboxContract<SpongeBobJettonAirdrop>;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeBobJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeBobJettonMinter', () => {
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
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonMinter are ready to use
    });

    it('should mint airdrop jetton to airdrop_wallet', async () => {
        const airdropValue = toNano("1000000000");
        let initialTotalSupply = await spongeBobJettonMinter.getTotalSupply();

        const airdropWalletJettonWallet = await userWallet(spongeBobAirdropContract.address);
        const res = await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeBobAirdropContract.address,
            airdropValue,
            null, deployer.address, null
        );
        expect(res.transactions).toHaveTransaction({
            on: airdropWalletJettonWallet.address,
            op: Op.internal_transfer,
            success: true,
        });
        const curBalance = await airdropWalletJettonWallet.getJettonBalance();
        expect(curBalance).toEqual(airdropValue);
        expect(await spongeBobJettonMinter.getTotalSupply()).toEqual(initialTotalSupply + airdropValue);

        const smc   = await blockchain.getContract(airdropWalletJettonWallet.address);
        if(smc.accountState === undefined)
            throw new Error("Can't access wallet account state");
        if(smc.accountState.type !== "active")
            throw new Error("Wallet account is not active");
        if(smc.account.account === undefined || smc.account.account === null)
            throw new Error("Can't access wallet account!");
        console.log("Jetton wallet max storage stats:", smc.account.account.storageStats.used);
    });

    // implementation detail
    it('not a minter admin should not be able to mint jettons', async () => {
        const airdropValue = toNano("350000000");
        let initialTotalSupply = await spongeBobJettonMinter.getTotalSupply();
        expect(initialTotalSupply).toEqual(0n);
        const unAuthMintResult = await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            notDeployer.getSender(),
            spongeBobAirdropContract.address,
            airdropValue,
            null, notDeployer.address, null
        );
        expect(unAuthMintResult.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: spongeBobJettonMinter.address,
            aborted: true,
            exitCode: Errors.not_owner,
        });   
        expect(await spongeBobJettonMinter.getTotalSupply()).toEqual(initialTotalSupply);
    });

    it('not a minter admin should not be able to mint jettons', async () => {
        const airdropValue = toNano("300000000");
        let initialTotalSupply = await spongeBobJettonMinter.getTotalSupply();
        expect(initialTotalSupply).toEqual(0n);

        const unAuthMintResult = await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeBobAirdropContract.address,
            airdropValue,
            null, deployer.address, null
        );
        expect(unAuthMintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeBobJettonMinter.address,
            aborted: true,
            exitCode: Errors.invalid_airdrop_amount,
        });   
        expect(await spongeBobJettonMinter.getTotalSupply()).toEqual(initialTotalSupply);
    });

    it('minter admin can change admin', async () => {
        const adminBefore = await spongeBobJettonMinter.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let res = await spongeBobJettonMinter.sendChangeAdmin(deployer.getSender(), notDeployer.address);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonMinter.address,
            success: true
        });

	    const adminAfter = await spongeBobJettonMinter.getAdminAddress();
        expect(adminAfter).toEqualAddress(notDeployer.address);
        await spongeBobJettonMinter.sendChangeAdmin(notDeployer.getSender(), deployer.address);
        expect((await spongeBobJettonMinter.getAdminAddress()).equals(deployer.address)).toBe(true);
    });

    it('not a minter admin can not change admin', async () => {
        const adminBefore = await spongeBobJettonMinter.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let changeAdmin = await spongeBobJettonMinter.sendChangeAdmin(notDeployer.getSender(), notDeployer.address);
        expect((await spongeBobJettonMinter.getAdminAddress()).equals(deployer.address)).toBe(true);
        expect(changeAdmin.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobJettonMinter.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('anyone can top up', async () => {
        const adminBefore = await spongeBobJettonMinter.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        const beforeBalance = await spongeBobJettonMinter.getBalance();

        let topUpTx = await spongeBobJettonMinter.sendTopUp(notDeployer.getSender());
        expect(topUpTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobJettonMinter.address,
            success: true
        });
        const afterBalance = await spongeBobJettonMinter.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('1'));
    });
});
