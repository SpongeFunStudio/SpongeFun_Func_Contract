import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { SpongeFunJettonVestingLockup } from '../wrappers/SpongeFunJettonVestingLockup';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { SpongeFunJettonWallet } from '../wrappers/SpongeFunJettonWallet';
import { SpongeFunJettonAirdrop } from '../wrappers/SpongeFunJettonAirdrop';
import { jettonContentToCell, SpongeFunJettonMinter } from '../wrappers/SpongeFunJettonMinter';
import { SpongeFunJettonPublicSale } from '../wrappers/SpongeFunJettonPublicSale';
import { Errors } from '../wrappers/JettonConstants';
import { DENOMINATOR, TEAM_PERCENTAGE, TOTAL_SUPPLY } from '../wrappers/JettonConstants';


let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
let user2: SandboxContract<TreasuryContract>;
let spongeFunJettonMinter: SandboxContract<SpongeFunJettonMinter>;
let spongeFunAirdropContract: SandboxContract<SpongeFunJettonAirdrop>;
let spongeFunJettonPublicSale: SandboxContract<SpongeFunJettonPublicSale>;
let spongeFunJettonVestingLockup: SandboxContract<SpongeFunJettonVestingLockup>;
let jwallet_code: Cell;
let team_amount: bigint;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeFunJettonWallet>>;

async function randomKp() {
    let mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

describe('SpongeFunJettonVestingLockup', () => {
    let spongeFunMinterCode: Cell;
    let spongeFunAirdropCode: Cell;
    let spongeFunPublicSaleCode: Cell;
    let spongeFunJettonVestingLockupCode: Cell;
    let kp: KeyPair;
    let now: number;

    beforeAll(async () => {
        spongeFunMinterCode = await compile('SpongeFunJettonMinter');
        spongeFunAirdropCode = await compile('SpongeFunJettonAirdrop');
        spongeFunPublicSaleCode = await compile('SpongeFunJettonPublicSale');
        spongeFunJettonVestingLockupCode = await compile('SpongeFunJettonVestingLockup');
    });

    beforeEach(async () => {

        blockchain = await Blockchain.create();
        kp = await randomKp();
        deployer = await blockchain.treasury('deployer');
        notDeployer  = await blockchain.treasury('notDeployer');
        user = await blockchain.treasury('user');
        user2 = await blockchain.treasury('user2');

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

        spongeFunJettonPublicSale = blockchain.openContract(
            SpongeFunJettonPublicSale.createFromConfig({
                    sponge_fun_minter_address: spongeFunJettonMinter.address,
                    admin_address: deployer.address,
                    jetton_wallet_code: jwallet_code,
                },
            spongeFunPublicSaleCode
            ));
        now = (parseInt((new Date().getTime() / 1000).toFixed(0)));
        spongeFunJettonVestingLockup = blockchain.openContract(
            SpongeFunJettonVestingLockup.createFromConfig({
                    sponge_fun_minter_address: spongeFunJettonMinter.address,
                    admin_address: deployer.address,
                    total_lock_amount: toNano('120000000'),
                    start_time: BigInt(now),
                    total_duration: 1000,
                    unlock_period: 100,
                    cliff_duration: 100, 
                    jetton_wallet_code: jwallet_code,
                },
                spongeFunJettonVestingLockupCode
            ))
        
        userWallet = async (address:Address) => blockchain.openContract(
                          SpongeFunJettonWallet.createFromAddress(
                            await spongeFunJettonMinter.getWalletAddress(address)
                          )
                     );
        await spongeFunJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeFunAirdropContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeFunJettonPublicSale.sendDeploy(deployer.getSender(), toNano('0.05'));
        await spongeFunJettonVestingLockup.sendDeploy(deployer.getSender(), toNano('0.05'));

        //mint all token to airdrop contract
        await spongeFunJettonMinter.sendMintToClaimAirdropMessage(
            deployer.getSender(),
            spongeFunAirdropContract.address,
            TOTAL_SUPPLY,
            null, null, null
        );
        //claim airdrop
        const claimAmount = toNano("100000000");
        for (let i = 0; i < 4; i++) {
            await spongeFunAirdropContract.sendClaimAirdropTokenMessage(
                user.getSender(),
                i,
                claimAmount,
                kp.secretKey
            );
        }
        //mint to public sale
        await spongeFunJettonPublicSale.sendStartSaleTokenMessage(
            deployer.getSender(),
            toNano('0.05')
        );
        await spongeFunAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            spongeFunJettonPublicSale.address
        );
        //sold out
        for (let i = 0; i < 3; i++) {
            await spongeFunJettonPublicSale.sendBuyTokenMessage(
                user2.getSender(),
                toNano('1.1')
            );
        }

        await spongeFunJettonPublicSale.sendMintToTeamMessage(
            deployer.getSender(),
            toNano('0.05'),
            spongeFunJettonVestingLockup.address
        );

        let treasuryWallet = await userWallet(spongeFunJettonVestingLockup.address);
        const treasuryBalance = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance).toEqual(TOTAL_SUPPLY * BigInt(TEAM_PERCENTAGE) / BigInt(DENOMINATOR));
        team_amount = TOTAL_SUPPLY * BigInt(TEAM_PERCENTAGE) / BigInt(DENOMINATOR)
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeFunJettonVestingLockup are ready to use
    });

    it('should failed if not admin address', async () => {
        const res = await spongeFunJettonVestingLockup.sendVestingLockupMessage(
            notDeployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: notDeployer.address,
            on: spongeFunJettonVestingLockup.address,
            aborted: true,
            exitCode: Errors.not_owner, // error::unauthorized_change_admin_request
        });
    });

    it('should claim 0 amount if not reach one cliff_diration', async () => {
        expect(await spongeFunJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("0"));
        expect(await spongeFunJettonVestingLockup.getTotalLockAmount()).toEqual(toNano("120000000"));

        blockchain.now = now + 99;
        const res = await spongeFunJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunJettonVestingLockup.address,
            aborted: true,
            exitCode: Errors.already_unlock_all,
        });
    });

    it('should claim 0 amount if not reach one cliff_diration', async () => {
        expect(await spongeFunJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("0"));
        expect(await spongeFunJettonVestingLockup.getTotalLockAmount()).toEqual(toNano("120000000"));

        blockchain.now = now + 199;
        const res = await spongeFunJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunJettonVestingLockup.address,
            aborted: true,
            exitCode: Errors.already_unlock_all,
        });
    });

    it('should claim 1/10 amount if reach one period after cliff_diration', async () => {
        expect(await spongeFunJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(toNano("0"));
        expect(await spongeFunJettonVestingLockup.getTotalLockAmount()).toEqual(toNano("120000000"));
        let deployerWallet = await userWallet(deployer.address);

        blockchain.now = now + 250;
        const res = await spongeFunJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            on: spongeFunJettonVestingLockup.address,
            success: true,
        });
        const deployerBalance = await deployerWallet.getJettonBalance();
        expect(deployerBalance).toEqual(team_amount/BigInt(10));
        expect(await spongeFunJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(team_amount/BigInt(10));

        let treasuryWallet = await userWallet(spongeFunJettonVestingLockup.address);
        const treasuryBalance = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance).toEqual(team_amount * BigInt(9) / BigInt(10));

        blockchain.now = now + 650;
        await spongeFunJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        const deployerBalance1 = await deployerWallet.getJettonBalance();
        expect(deployerBalance1).toEqual(team_amount * BigInt(5) / BigInt(10));
        expect(await spongeFunJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(team_amount * BigInt(5) / BigInt(10));
        const treasuryBalance1 = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance1).toEqual(team_amount * BigInt(5) / BigInt(10));

        blockchain.now = now + 1150;
        await spongeFunJettonVestingLockup.sendVestingLockupMessage(
            deployer.getSender(),
            toNano('0.05')
        )
        const deployerBalance2 = await deployerWallet.getJettonBalance();
        expect(deployerBalance2).toEqual(team_amount);
        expect(await spongeFunJettonVestingLockup.getAlreadyUnlockAmount()).toEqual(team_amount);
        const treasuryBalance2 = await treasuryWallet.getJettonBalance();
        expect(treasuryBalance2).toEqual(toNano("0"));
    });
});
