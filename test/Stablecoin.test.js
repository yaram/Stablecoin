const { use, expect } = require('chai');
const { solidity, createMockProvider, getWallets, deployContract, par } = require('ethereum-waffle');
const ethers = require('ethers');
const TestStablecoin = require('../build/TestStablecoin.json');
const TestPriceSource = require('../build/TestPriceSource.json');

use(solidity);

describe('Stablecoin smart contract', () => {
    const provider = createMockProvider();
    const [firstWallet, secondWallet] = getWallets(provider);

    async function deployContracts() {
        const ethPriceSource = await deployContract(firstWallet, TestPriceSource, [100]);
        const tokenPriceSource = await deployContract(firstWallet, TestPriceSource, [10]);

        const stablecoin = await deployContract(firstWallet, TestStablecoin, [
            ethPriceSource.address,
            tokenPriceSource.address,
            150,
            'Test',
            'TST'
        ]);

        await stablecoin.mint(firstWallet.address, ethers.utils.parseEther('1000'));
        await stablecoin.mint(secondWallet.address, ethers.utils.parseEther('1000'));

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

    it('can create a new vault', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        await stablecoin.createVault();

        expect(await stablecoin.vaultExistance(0)).to.be.true;
        expect(await stablecoin.vaultOwner(0)).to.equal(firstWallet.address);
        expect(await stablecoin.vaultCollateral(0)).to.equal(0);
        expect(await stablecoin.vaultDebt(0)).to.equal(0);
    });

    it('can deposit collateral in a vault', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        await stablecoin.createVault();

        const amount = ethers.utils.parseEther('0.1');

        const beforeBalance = await firstWallet.getBalance();

        const transaction = await stablecoin.depositCollateral(0, { value: amount });

        const receipt = await transaction.wait();

        const fee = receipt.gasUsed.mul(transaction.gasPrice);

        expect(await stablecoin.vaultCollateral(0)).to.equal(amount);
        expect(await firstWallet.getBalance()).to.equal(beforeBalance.sub(amount).sub(fee));
    });

    it('can borrow token debt on a vault', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        await stablecoin.createVault();

        await stablecoin.depositCollateral(0, { value: ethers.utils.parseEther('0.1') });

        const amount = ethers.utils.parseEther('0.001');

        const beforeBalance = await stablecoin.balanceOf(firstWallet.address);

        await stablecoin.borrowToken(0, amount);

        expect(await stablecoin.vaultDebt(0)).to.equal(amount);
        expect(await stablecoin.balanceOf(firstWallet.address)).to.equal(beforeBalance.add(amount));
    });

    it('can withdraw collateral from a vault', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        await stablecoin.createVault();

        const amount = ethers.utils.parseEther('0.1');

        await stablecoin.depositCollateral(0, { value: amount });

        const beforeBalance = await firstWallet.getBalance();

        const transaction = await stablecoin.withdrawCollateral(0, amount);

        const receipt = await transaction.wait();

        const fee = receipt.gasUsed.mul(transaction.gasPrice);

        expect(await stablecoin.vaultCollateral(0)).to.equal(0);
        expect(await firstWallet.getBalance()).to.equal(beforeBalance.add(amount).sub(fee));
    });

    it('can pay back token debt on a vault', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        await stablecoin.createVault();

        await stablecoin.depositCollateral(0, { value: ethers.utils.parseEther('0.1') });

        const amount = ethers.utils.parseEther('0.001');

        await stablecoin.borrowToken(0, amount);

        const beforeBalance = await stablecoin.balanceOf(firstWallet.address);

        await stablecoin.payBackToken(0, amount);

        expect(await stablecoin.vaultDebt(0)).to.equal(0);
        expect(await stablecoin.balanceOf(firstWallet.address)).to.equal(beforeBalance.sub(amount));
    });

    it('can buy a risky vault', async () => {
        const [ethPriceSource, tokenPriceSource, stablecoin] = await deployContracts();

        await stablecoin.createVault();

        await stablecoin.depositCollateral(0, { value: ethers.utils.parseEther('0.1') });

        await stablecoin.borrowToken(0, ethers.utils.parseEther('0.001'));

        await ethPriceSource.setPrice(ethers.utils.parseEther('0.000001'));

        const beforeBalance = await stablecoin.balanceOf(secondWallet.address);

        await stablecoin.connect(secondWallet).buyRiskyVault(0);

        expect(await stablecoin.vaultOwner(0)).to.equal(secondWallet.address);
        expect(await stablecoin.vaultDebt(0)).to.equal(0);
        expect(await stablecoin.balanceOf(secondWallet.address)).to.be.lessThan(beforeBalance);
    });
});