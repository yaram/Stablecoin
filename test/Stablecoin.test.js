const { use, expect } = require('chai');
const { solidity, createMockProvider, getWallets, deployContract } = require('ethereum-waffle');
const Stablecoin = require('../build/Stablecoin.json');
const TestPriceSource = require('../build/TestPriceSource.json');

use(solidity);

describe('Stablecoin smart contract', () => {
    const provider = createMockProvider();
    const [firstWallet, secondWallet] = getWallets(provider);

    async function deployContracts() {
        const ethPriceSource = await deployContract(firstWallet, TestPriceSource, [100]);
        const tokenPriceSource = await deployContract(firstWallet, TestPriceSource, [10]);

        const stablecoin = await deployContract(firstWallet, Stablecoin, [
            ethPriceSource.address,
            tokenPriceSource.address,
            150,
            'Test',
            'TST'
        ]);

        return [ethPriceSource, tokenPriceSource, stablecoin];
    }

    it('deploys and correctly sets initial state', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        expect(await stablecoin.ethPriceSource()).to.equal(ethPriceSource.address);
        expect(await stablecoin.tokenPriceSource()).to.equal(tokenPriceSource.address);

        expect(await stablecoin.vaultCount()).to.equal(0);

        expect(await stablecoin.name()).to.equal('Test');
        expect(await stablecoin.symbol()).to.equal('TST');
        expect(await stablecoin.decimals()).to.equal(18);
    });
});