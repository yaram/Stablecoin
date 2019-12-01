const ganache = require('ganache-core');
const Bundler = require('parcel-bundler');
const ethers = require('ethers');
const TestStablecoin = require('./build/TestStablecoin.json');
const TestPriceSource = require('./build/TestPriceSource.json');

ganache.server().listen(8545, (err, blockchain) => {
    if(err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log('Ganache server listening on port 8545');

        console.log('Accounts:');
        for(const address in blockchain.accounts) {
            console.log(`  ${address} : 0x${blockchain.accounts[address].secretKey.toString('hex')}`);
        }

        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

        const wallet = new ethers.Wallet(blockchain.accounts[blockchain.coinbase].secretKey, provider);

        const testStablecoinFactory = ethers.ContractFactory.fromSolidity(TestStablecoin, wallet);
        const testPriceSourceFactory = ethers.ContractFactory.fromSolidity(TestPriceSource, wallet);

        testPriceSourceFactory.deploy(ethers.utils.parseEther('100'))
            .then(ethPriceSource => {
                return Promise.all([
                    ethPriceSource,
                    testPriceSourceFactory.deploy(ethers.utils.parseEther('1'))
                ]);
            })
            .then(([ethPriceSource, tokenPriceSource]) => {
                return testStablecoinFactory.deploy(ethPriceSource.address, tokenPriceSource.address, 150, 'Test', 'TEST');
            })
            .then(stablecoin => {
                console.log(`Primary contract deployed at ${stablecoin.address}`);

                process.env.CONTRACT_ADDRESS = stablecoin.address;
                process.env.MINIMUM_COLLATERAL_PERCENTAGE = 150;
                process.env.TOKEN_SYMBOL = 'TEST';
                process.env.TARGET_SYMBOL = 'USD';

                const bundler = new Bundler('src/index.html');

                return bundler.serve();
            })
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    }
});