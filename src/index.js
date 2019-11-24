import { h, diff, patch, create } from 'virtual-dom';
import { ethers } from 'ethers';
import Stablecoin from '../build/Stablecoin.json';
import PriceSource from '../build/PriceSource.json';

async function connect() {
    update({ ...state, message: null });

    try {
        if(process.env.NODE_ENV === 'production') {
            if(window.ethereum) {
                    const addresses = await window.ethereum.enable();

                    const provider = new ethers.providers.Web3Provider(window.ethereum);

                    update({
                        ...state,
                        provider,
                        signer: provider.getSigner(),
                        address: addresses[0]
                    });
            } else if(window.web3) {
                const provider = new ethers.providers.Web3Provider(window.web3.currentProvider);
                const signer = provider.getSigner();

                const address = await signer.getAddress();

                update({ ...state, provider, signer, address });
            } else {
                return {
                    ...state,
                    message: 'No wallet present'
                };
            }
        } else {
            const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
            const signer = provider.getSigner();

            const address = await signer.getAddress();

            update({ ...state, provider, signer, address });
        }
    } catch(err) {
        console.log(err);

        update({ ...state, message: 'Unable to connect to wallet'});
    }
}

async function loadVaults() {
    update({
        ...state,
        vaults: []
    });

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.provider);

    const vaultCount = await contract.vaultCount();

    for(var i = 0; i < vaultCount; i += 1) {
        const existance = await contract.vaultExistance(i);

        if(existance) {
            const owner = await contract.vaultOwner(i);
            const collateral = await contract.vaultCollateral(i);
            const debt = await contract.vaultDebt(i);

            update({
                ...state,
                vaults: [...state.vaults, {
                    id: i,
                    owner,
                    collateral,
                    debt
                }]
            });
        }
    }
}

async function loadPrices() {
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.provider);

    const ethPriceSourceAddress = await contract.ethPriceSource();
    const ethPriceSource = new ethers.Contract(ethPriceSourceAddress, PriceSource.abi, state.provider);

    const tokenPriceSourceAddress = await contract.tokenPriceSource();
    const tokenPriceSource = new ethers.Contract(tokenPriceSourceAddress, PriceSource.abi, state.provider);

    const ethPrice = await ethPriceSource.getPrice();
    const tokenPrice = await tokenPriceSource.getPrice();

    update({
        ...state,
        ethPrice,
        tokenPrice
    });
}

async function createVault() {
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.createVault();

    loadVaults();
    loadPrices();
}

function render() {
    return h('div', {}, [
        state.message !== null ?
            h('div', {}, state.message) :
            [],
        h('div', {}, [
            state.signer === null ?
            h('button', { onclick: connect }, 'Connect') :
            [
                h('div', {}, 'Connected to wallet'),
                h('div', {},  state.address !== null ? state.address : 'Loading address...')
            ]
        ]),
        state.signer !== null ?
            h('button', { onclick: createVault }, 'Create Vault') :
            [],
        state.vaults.map(vault => h('div', {},
            state.ethPrice !== null && state.tokenPrice !== null ?
                `${vault.id} (${vault.owner}): ${vault.debt}/${vault.collateral} (${vault.debt * state.tokenPrice}/${vault.collateral * state.ethPrice})` :
                `${vault.id} (${vault.owner}): ${vault.debt}/${vault.collateral}`
        ))
    ]);
}

let state = {
    message: null,
    provider: process.env.NODE_ENV === 'production' ? ethers.getDefaultProvider() : new ethers.providers.JsonRpcProvider('http://localhost:8545'),
    signer: null,
    address: null,
    vaults: [],
    ethPrice: null,
    tokenPrice: null
};
let tree = render();
let root = create(tree);
document.body.appendChild(root);

function update(newState) {
    state = newState;

    const newTree = render();

    const patches = diff(tree, newTree);
    root = patch(root, patches);

    tree = newTree;
}

loadVaults();
loadPrices();