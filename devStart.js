const crypto = require('crypto');
const ganache = require('ganache-core');
const Bundler = require('parcel-bundler');
const ethers = require('ethers');
const Stablecoin = require('./build/Stablecoin.json');
const ConstantPriceSource = require('./build/ConstantPriceSource.json');

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

        const stablecoinFactory = ethers.ContractFactory.fromSolidity(Stablecoin, wallet);
        const constantPriceSourceFactory = ethers.ContractFactory.fromSolidity(ConstantPriceSource, wallet);

        constantPriceSourceFactory.deploy(ethers.utils.parseEther('100'))
            .then(ethPriceSource => {
                return Promise.all([
                    ethPriceSource,
                    constantPriceSourceFactory.deploy(ethers.utils.parseEther('1'))
                ]);
            })
            .then(([ethPriceSource, tokenPriceSource]) => {
                return stablecoinFactory.deploy(ethPriceSource.address, tokenPriceSource.address, 150, "Test", "TEST");
            })
            .then(stablecoin => {
                console.log(`Primary contract deployed at ${stablecoin.address}`);

                process.env.CONTRACT_ADDRESS = stablecoin.address;

                const bundler = new Bundler('src/index.html');

                return bundler.serve();
            })
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    }
});