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
// let publicSale: SandboxContract<TreasuryContract>;
// let team: SandboxContract<TreasuryContract>;
// let treasury: SandboxContract<TreasuryContract>;
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
        console.log("spongeBobJettonMinter address:", spongeBobJettonMinter.address);
        
        spongeBobAirdropContract = blockchain.openContract(
            SpongeBobJettonAirdrop.createFromConfig({
                    public_key: kp.publicKey,
                    sponge_bob_minter_address: spongeBobJettonMinter.address,
                    admin_address: deployer.address
                },
                spongeBobAirdropCode
            ));
        console.log("spongeBobAirdropContract address:", spongeBobAirdropContract.address);

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
        const airdropValue = toNano("350000000");
        let initialTotalSupply = await spongeBobJettonMinter.getTotalSupply();

        const airdropWalletJettonWallet = await userWallet(spongeBobAirdropContract.address);
        const res = await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeBobAirdropContract.address,
            airdropValue,
            null, null, null
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
            null, null, null
        );
        expect(unAuthMintResult.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: spongeBobJettonMinter.address,
            aborted: true,
            exitCode: Errors.not_owner,
        });   
        expect(await spongeBobJettonMinter.getTotalSupply()).toEqual(initialTotalSupply);
    });
});
