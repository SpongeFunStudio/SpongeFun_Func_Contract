import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
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

        const claimAmount = toNano("300000000");
        await spongeBobAirdropContract.sendClaimAirdropTokenMessage(
            user.getSender(),
            0,
            claimAmount,
            kp.secretKey
        );
        await spongeBobAirdropContract.sendMintToPublicSaleContractMessage(
            deployer.getSender(),
            spongeBobJettonPublicSale.address
        );
        const publicSaleContractWallet = await userWallet(spongeBobJettonPublicSale.address);
        const publicSaleContractBalance = await publicSaleContractWallet.getJettonBalance();
        expect(publicSaleContractBalance).toEqual(toNano(650000000));
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
        expect(beforeBalance).toEqual(toNano("300000000"));

        const res1 = await spongeBobJettonPublicSale.sendBuyTokenMessage(
            user.getSender(),
            toNano('500.1')
        );
        expect(res1.transactions).toHaveTransaction({
            from: user.address,
            on: spongeBobJettonPublicSale.address,
            success: true,
        });
        const afterBalance = await userJettonWallet.getJettonBalance();
        expect(afterBalance).toEqual(beforeBalance + toNano("500"));
    });
});
