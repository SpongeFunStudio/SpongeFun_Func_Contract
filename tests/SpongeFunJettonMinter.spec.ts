import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell, storeStateInit, toNano } from '@ton/core';
import { SpongeFunJettonMinter, jettonContentToCell } from '../wrappers/SpongeFunJettonMinter';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { SpongeFunJettonWallet } from '../wrappers/SpongeFunJettonWallet';
import { Errors, Op } from '../wrappers/JettonConstants';
import { mnemonicNew, sign, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { SpongeFunJettonAirdrop } from '../wrappers/SpongeFunJettonAirdrop';

let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let spongeFunJettonMinter: SandboxContract<SpongeFunJettonMinter>;
let spongeFunAirdropContract: SandboxContract<SpongeFunJettonAirdrop>;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeFunJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeFunJettonMinter', () => {
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
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeFunJettonMinter are ready to use
    });

    it('should mint airdrop jetton to airdrop_wallet', async () => {
        const airdropValue = toNano("1000000000");
        let initialTotalSupply = await spongeFunJettonMinter.getTotalSupply();

        const airdropWalletJettonWallet = await userWallet(spongeFunAirdropContract.address);
        const res = await spongeFunJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeFunAirdropContract.address,
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
        expect(await spongeFunJettonMinter.getTotalSupply()).toEqual(initialTotalSupply + airdropValue);

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
        let initialTotalSupply = await spongeFunJettonMinter.getTotalSupply();
        expect(initialTotalSupply).toEqual(0n);
        const unAuthMintResult = await spongeFunJettonMinter.sendMintToClaimAirdropMessage(
            notDeployer.getSender(),
            spongeFunAirdropContract.address,
            airdropValue,
            null, notDeployer.address, null
        );
        expect(unAuthMintResult.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: spongeFunJettonMinter.address,
            aborted: true,
            exitCode: Errors.not_owner,
        });   
        expect(await spongeFunJettonMinter.getTotalSupply()).toEqual(initialTotalSupply);
    });

    it('not a minter admin should not be able to mint jettons', async () => {
        const airdropValue = toNano("300000000");
        let initialTotalSupply = await spongeFunJettonMinter.getTotalSupply();
        expect(initialTotalSupply).toEqual(0n);

        const unAuthMintResult = await spongeFunJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeFunAirdropContract.address,
            airdropValue,
            null, deployer.address, null
        );
        expect(unAuthMintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: spongeFunJettonMinter.address,
            aborted: true,
            exitCode: Errors.invalid_airdrop_amount,
        });   
        expect(await spongeFunJettonMinter.getTotalSupply()).toEqual(initialTotalSupply);
    });

    it('minter admin can change admin', async () => {
        const adminBefore = await spongeFunJettonMinter.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let res = await spongeFunJettonMinter.sendChangeAdmin(deployer.getSender(), notDeployer.address);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunJettonMinter.address,
            success: true
        });

	    const adminAfter = await spongeFunJettonMinter.getAdminAddress();
        expect(adminAfter).toEqualAddress(notDeployer.address);
        await spongeFunJettonMinter.sendChangeAdmin(notDeployer.getSender(), deployer.address);
        expect((await spongeFunJettonMinter.getAdminAddress()).equals(deployer.address)).toBe(true);
    });

    it('not a minter admin can not change admin', async () => {
        const adminBefore = await spongeFunJettonMinter.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        let changeAdmin = await spongeFunJettonMinter.sendChangeAdmin(notDeployer.getSender(), notDeployer.address);
        expect((await spongeFunJettonMinter.getAdminAddress()).equals(deployer.address)).toBe(true);
        expect(changeAdmin.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunJettonMinter.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('anyone can top up', async () => {
        const adminBefore = await spongeFunJettonMinter.getAdminAddress();
        expect(adminBefore).toEqualAddress(deployer.address);
        const beforeBalance = await spongeFunJettonMinter.getBalance();

        let topUpTx = await spongeFunJettonMinter.sendTopUp(notDeployer.getSender());
        expect(topUpTx.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunJettonMinter.address,
            success: true
        });
        const afterBalance = await spongeFunJettonMinter.getBalance();
        expect(afterBalance).toBeLessThan(beforeBalance + toNano('0.05'));
    });
});
