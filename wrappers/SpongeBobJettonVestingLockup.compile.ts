import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'func',
    targets: ['contracts/sponge_bob_jetton_vesting_lockup.fc'],
};
