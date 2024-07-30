import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { SpongeBobJettonPublicSale } from '../wrappers/SpongeBobJettonPublicSale';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { jettonContentToCell, SpongeBobJettonMinter } from '../wrappers/SpongeBobJettonMinter';
import { SpongeBobJettonAirdrop } from '../wrappers/SpongeBobJettonAirdrop';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';
import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from 'ton-crypto';


let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let notDeployer: SandboxContract<TreasuryContract>;
let user: SandboxContract<TreasuryContract>;
let public_sale_contract: SandboxContract<TreasuryContract>;
let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;
let spongeBobAirdropContract: SandboxContract<SpongeBobJettonAirdrop>;
let spongeBobJettonPublicSale: SandboxContract<SpongeBobJettonPublicSale>;
let spongeBobWalletContract: SandboxContract<SpongeBobJettonWallet>;
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

        spongeBobJettonPublicSale = blockchain.openContract(
            SpongeBobJettonPublicSale.createFromConfig({
                    total_sale: 0n,
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
        const deployResult0 = await spongeBobJettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));
        const deployResult1 = await spongeBobAirdropContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        const allTokenAmount = toNano("1000000000");
        const res = await spongeBobJettonMinter.sendMintToClaimAirdropMessage(
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
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonPublicSale are ready to use
    });
});
