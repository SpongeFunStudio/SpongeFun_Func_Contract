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
        
        spongeBobJettonVestingLockup = blockchain.openContract(
            SpongeBobJettonVestingLockup.createFromConfig({
                    sponge_bob_minter_address: spongeBobJettonMinter.address,
                    admin_address: deployer.address,
                    start_time: parseInt((new Date().getTime() / 1000).toFixed(0)),
                    total_duration: 1000,
                    unlock_period: 10,
                    cliff_duration: 100,
                    total_lock_amount: 1000,
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
        expect(treasuryBalance).toEqual(toNano("200000000"));

    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonVestingLockup are ready to use
    });
});
