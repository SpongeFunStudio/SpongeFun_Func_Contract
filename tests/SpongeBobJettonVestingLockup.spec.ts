import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { SpongeBobJettonVestingLockup } from '../wrappers/SpongeBobJettonVestingLockup';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { SpongeBobJettonPublicSale } from '../wrappers/SpongeBobJettonPublicSale';
import { Errors } from '../wrappers/JettonConstants';


let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
let user2: SandboxContract<TreasuryContract>;
let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;
let spongeBobAirdropContract: SandboxContract<SpongeBobJettonAirdrop>;
let spongeBobJettonPublicSale: SandboxContract<SpongeBobJettonPublicSale>;
let spongeBobJettonVestingLockup: SandboxContract<SpongeBobJettonVestingLockup>;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeBobJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeBobJettonVestingLockup', () => {
    let spongeBobMinterCode: Cell;
    let spongeBobAirdropCode: Cell;
    let spongeBobPublicSaleCode: Cell;
    let spongeBobJettonVestingLockupCode: Cell;
    let kp: KeyPair;
    let now: number;

    beforeAll(async () => {
        spongeBobMinterCode = await compile('SpongeBobJettonMinter');
        spongeBobAirdropCode = await compile('SpongeBobJettonAirdrop');
        spongeBobPublicSaleCode = await compile('SpongeBobJettonPublicSale');
        spongeBobJettonVestingLockupCode = await compile('SpongeBobJettonVestingLockup');
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
        now = (parseInt((new Date().getTime() / 1000).toFixed(0)));
        spongeBobJettonVestingLockup = blockchain.openContract(
            SpongeBobJettonVestingLockup.createFromConfig({
                    sponge_bob_minter_address: spongeBobJettonMinter.address,
                    admin_address: deployer.address,
                    total_lock_amount: toNano('120000000'),
                    start_time: BigInt(now),
                    total_duration: 1000,
                    unlock_period: 100,
                    cliff_duration: 100, 
                    jetton_wallet_code: jwallet_code,
                },
                spongeBobJettonVestingLockupCode
            ))
        
        userWallet = async (address:Address) => blockchain.openContract(
                          SpongeBobJettonWallet.createFromAddress(
                            await spongeBobJettonMinter.getWalletAddress(address)
                          )
                     );
        await spongeBobJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeBobAirdropContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeBobJettonPublicSale.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeBobJettonVestingLockup.sendDeploy(deployer.getSender(), toNano('0.05'));

        //mint all token to airdrop contract
        const allTokenAmount = toNano("1000000000");
        await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeBobAirdropContract.address,
            allTokenAmount,
            null, null, null
        );
        //claim airdrop
        const claimAmount = toNano("100000000");
        for (let i = 0; i < 2; i++) {
            await spongeBobAirdropContract.sendClaimAirdropTokenMessage(
                user.getSender(),
                i,
                claimAmount,
                kp.secretKey
            );
        }
        //mint to public sale
        await spongeBobJettonPublicSale.sendStartSaleTokenMessage(
            deployer.getSender(),
            toNano('0.05')
        );
        await spongeBobAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            spongeBobJettonPublicSale.address
        );
        //sold out
        for (let i = 0; i < 4; i++) {
            await spongeBobJettonPublicSale.sendBuyTokenMessage(
                user2.getSender(),
                toNano('1.1')
            );
        }

        await spongeBobJettonPublicSale.sendMintToTreasuryMessage(
            deployer.getSender(),
            toNano('0.05'),
            spongeBobJettonVestingLockup.address
        );

        let treasuryWallet = await userWallet(spongeBobJettonVestingLockup.address);
        const treasuryBalance = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance).toEqual(toNano("120000000"));
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonVestingLockup are ready to use
    });

    it('should failed if not admin address', async () => {
        const res = await spongeBobJettonVestingLockup.sendVestingLockupMessage(
            notDeployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeBobJettonVestingLockup.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('should claim 0 amount if not reach one cliff_diration', async () => {
        expect(await spongeBobJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("0"));
        expect(await spongeBobJettonVestingLockup.getTotalLockAmount()).toEqual(toNano("120000000"));

        blockchain.now = now + 99;
        const res = await spongeBobJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonVestingLockup.address,
            aborted: true,
            exitCode: Errors.already_unlock_all,
        });
    });

    it('should claim 0 amount if not reach one cliff_diration', async () => {
        expect(await spongeBobJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("0"));
        expect(await spongeBobJettonVestingLockup.getTotalLockAmount()).toEqual(toNano("120000000"));

        blockchain.now = now + 199;
        const res = await spongeBobJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonVestingLockup.address,
            aborted: true,
            exitCode: Errors.already_unlock_all,
        });
    });

    it('should claim 1/10 amount if reach one period after cliff_diration', async () => {
        expect(await spongeBobJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("0"));
        expect(await spongeBobJettonVestingLockup.getTotalLockAmount()).toEqual(toNano("120000000"));
        let deployerWallet = await userWallet(deployer.address);

        blockchain.now = now + 250;
        const res = await spongeBobJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeBobJettonVestingLockup.address,
            success: true,
        });
        const deployerBalance = await deployerWallet.getJettonBalance();
        expect(deployerBalance).toEqual(toNano("12000000"));
        expect(await spongeBobJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("12000000"));

        let treasuryWallet = await userWallet(spongeBobJettonVestingLockup.address);
        const treasuryBalance = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance).toEqual(toNano("108000000"));

        blockchain.now = now + 650;
        await spongeBobJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        const deployerBalance1 = await deployerWallet.getJettonBalance();
        expect(deployerBalance1).toEqual(toNano("60000000"));
        expect(await spongeBobJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("60000000"));
        const treasuryBalance1 = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance1).toEqual(toNano("60000000"));

        blockchain.now = now + 1150;
        await spongeBobJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        const deployerBalance2 = await deployerWallet.getJettonBalance();
        expect(deployerBalance2).toEqual(toNano("120000000"));
        expect(await spongeBobJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("120000000"));
        const treasuryBalance2 = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance2).toEqual(toNano("0"));
    });
});
