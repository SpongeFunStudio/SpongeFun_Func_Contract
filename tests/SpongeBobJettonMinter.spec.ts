import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell, toNano } from '@ton/core';
import { SpongeBobJettonMinter, jettonContentToCell } from '../wrappers/SpongeBobJettonMinter';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { SpongeBobJettonWallet } from '../wrappers/SpongeBobJettonWallet';

let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
// let airdrop: SandboxContract<TreasuryContract>;
// let publicSale: SandboxContract<TreasuryContract>;
// let team: SandboxContract<TreasuryContract>;
// let treasury: SandboxContract<TreasuryContract>;
let spongeBobJettonMinter: SandboxContract<SpongeBobJettonMinter>;
let jwallet_code_raw: Cell;
let jwallet_code: Cell;

let userWallet: (address: Address) => Promise<SandboxContract<SpongeBobJettonWallet>>;
    
describe('SpongeBobJettonMinter', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SpongeBobJettonMinter');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        // airdrop = await blockchain.treasury('airdrop');
        // publicSale = await blockchain.treasury('publicSale');
        // team = await blockchain.treasury('team');
        // treasury = await blockchain.treasury('treasury');

        jwallet_code_raw = await compile('SpongeBobJettonWallet');
        
        const _libs = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        _libs.set(BigInt(`0x${jwallet_code_raw.hash().toString('hex')}`), jwallet_code_raw);
        const libs = beginCell().storeDictDirect(_libs).endCell();
        blockchain.libs = libs;
        let lib_prep = beginCell().storeUint(2,8).storeBuffer(jwallet_code_raw.hash()).endCell();
        jwallet_code = new Cell({ exotic: true, bits: lib_prep.bits, refs: lib_prep.refs });
        
        console.log('jetton wallet code hash = ', jwallet_code.hash().toString('hex'));

        spongeBobJettonMinter = blockchain.openContract(SpongeBobJettonMinter.createFromConfig({
            max_supply: 1000000000,
            mintable: true,
            admin_address: deployer.address,
            // airdrop_contract_address: airdrop.address,
            // public_sale_contract_address: publicSale.address,
            // team_contract_address: team.address,
            // treasury_contract_address: treasury.address,
            jetton_wallet_code: jwallet_code,
            jetton_content: jettonContentToCell({uri: "https://ton.org/"})
        }, code));

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
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and spongeBobJettonMinter are ready to use
    });
});
