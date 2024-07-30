import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { mnemonicNew, sign, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';
import { Op } from '../wrappers/JettonConstants';

let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
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
        user  = await blockchain.treasury('user');
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
});
