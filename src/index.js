import { h, diff, patch, create } from 'virtual-dom';
import { ethers } from 'ethers';
import Stablecoin from '../build/Stablecoin.json';
import PriceSource from '../build/PriceSource.json';
import { stat } from 'fs';

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

                    loadBalances();
            } else if(window.web3) {
                const provider = new ethers.providers.Web3Provider(window.web3.currentProvider);
                const signer = provider.getSigner();

                update({ ...state, provider, signer});

                const address = await signer.getAddress();

                update({ ...state, address });

                loadBalances();
            } else {
                return {
                    ...state,
                    message: 'No wallet present'
                };
            }
        } else {
            const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
            const signer = provider.getSigner();

            update({ ...state, provider, signer });

            const address = await signer.getAddress();

            update({ ...state, address });

            loadBalances();
        }
    } catch(err) {
        console.log(err);

        update({ ...state, message: 'Unable to connect to wallet'});
    }
}

async function loadVaults() {
    let previousSelectedVaultID = null;
    if(state.selectedVaultIndex !== null) {
        previousSelectedVaultID = state.vaults[state.selectedVaultIndex].id;
    }

    update({
        ...state,
        vaults: [],
        selectedVaultIndex: null
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
                    debt,
                    amountText: ''
                }]
            });

            if(previousSelectedVaultID !== null && i == previousSelectedVaultID && state.selectedVaultIndex === null) {
                update({
                    ...state,
                    selectedVaultIndex: state.vaults.length - 1
                });
            }
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

async function loadBalances() {
    const ethBalance = await state.provider.getBalance(state.address);

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    const tokenBalance = await contract.balanceOf(state.address);
    
    update({...state, ethBalance, tokenBalance});
}

async function createVault() {
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.createVault();

    loadVaults();
    loadPrices();
}

function amountTextChange(e, index) {
    let vaults = [...state.vaults];

    vaults[index] = {
        ...state.vaults[index],
        amountText: e.target.value
    };

    update({
        ...state,
        vaults
    });
}

async function deposit(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.vaults[index].amountText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.depositCollateral(state.vaults[index].id, { value: amount });

    loadVaults();
    loadPrices();
    loadBalances();
}

async function withdraw(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.vaults[index].amountText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.withdrawCollateral(state.vaults[index].id, amount);

    loadVaults();
    loadPrices();
    loadBalances();
}

async function payBack(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.vaults[index].amountText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.payBackToken(state.vaults[index].id, amount);

    loadVaults();
    loadPrices();
    loadBalances();
}

async function borrow(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.vaults[index].amountText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.borrowToken(state.vaults[index].id, amount);

    loadVaults();
    loadPrices();
    loadBalances();
}

function vaultInfo(vault) {
    if(state.ethPrice && state.tokenPrice !== null) {
        return `${vault.id} (${vault.owner}): ${ethers.utils.formatEther(vault.debt)}/${ethers.utils.formatEther(vault.collateral)} (${ethers.utils.formatEther(vault.debt * state.tokenPrice)}/${ethers.utils.formatEther(vault.collateral * state.ethPrice)})`;
    } else {
        return `${vault.id} (${vault.owner}): ${ethers.utils.formatEther(vault.debt)}/${ethers.utils.formatEther(vault.collateral)}`;
    }
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
            [
                state.ethBalance !== null && state.tokenBalance !== null ?
                    h('div', {}, `Balance: ${ethers.utils.formatEther(state.ethBalance)}, ${ethers.utils.formatEther(state.tokenBalance)}`) :
                    [],
                h('button', { onclick: createVault }, 'Create Vault'),
                state.selectedVaultIndex !== null ?
                    [
                        h('div', {}, `Selected vault: ${vaultInfo(state.vaults[state.selectedVaultIndex])}`),
                        h('div', {}, [
                            h('input', { type: 'text', value: state.vaults[state.selectedVaultIndex].amountText, onchange: e => amountTextChange(e, state.selectedVaultIndex) }),
                            h('button', { onclick: () => deposit(state.selectedVaultIndex) }, 'Deposit ETH'),
                            h('button', { onclick: () => withdraw(state.selectedVaultIndex) }, 'Withdraw ETH'),
                            h('button', { onclick: () => payBack(state.selectedVaultIndex) }, 'Pay back token debt'),
                            h('button', { onclick: () => borrow(state.selectedVaultIndex) }, 'Borrow token')
                        ]),
                    ] :
                    [],
            ] :
            [],
        state.vaults.map((vault, index) => h('div', {}, [
            state.address !== null && vault.owner === state.address ?
                h('div', {}, [
                    vaultInfo(vault),
                    h('button', { onclick: () => update({ ...state, selectedVaultIndex: index }) }, 'Select')
                ]) :
                h('div', {}, vaultInfo(vault))
        ]))
    ]);
}

let state = {
    message: null,
    provider: process.env.NODE_ENV === 'production' ? ethers.getDefaultProvider() : new ethers.providers.JsonRpcProvider('http://localhost:8545'),
    signer: null,
    address: null,
    vaults: [],
    selectedVaultIndex: null,
    ethPrice: null,
    tokenPrice: null,
    ethBalance: null,
    tokenBalance: null
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