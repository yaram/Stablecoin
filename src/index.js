import { h, diff, patch, create } from 'virtual-dom';
import { ethers } from 'ethers';
import Stablecoin from '../build/Stablecoin.json';
import PriceSource from '../build/PriceSource.json';

async function connect() {
    state.walletError = null;
    update();

    if(process.env.NODE_ENV === 'production') {
        if(window.ethereum) {
                try {
                    const addresses = await window.ethereum.enable();
                    
                    const provider = new ethers.providers.Web3Provider(window.ethereum);
    
                    state.provider = provider;
                    state.signer = provider.getSigner();
                    state.address = addresses[0];
                    update();
    
                    loadBalances();
                } catch(err) {
                    state.walletError = 'Error connecting to web3 provider';

                    console.error(err);
                }
        } else if(window.web3) {
            const provider = new ethers.providers.Web3Provider(window.web3.currentProvider);
            const signer = provider.getSigner();

            try {
                const address = await signer.getAddress();

                state.provider = provider;
                state.signer = signer;
                state.address = address;
                update();

                loadBalances();
            } catch(err) {
                state.walletError = 'Error connecting to web3 provider';

                console.error(err);
            }
        } else {
            state.walletError = 'No web3 provider found';
            update();
        }
    } else {
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const signer = provider.getSigner();

        try {
            const address = await signer.getAddress();

            state.provider = provider;
            state.signer = signer;
            state.address = address;
            update();

            loadBalances();
        } catch(err) {
            state.walletError = 'Error connecting to development node';

            console.error(err);
        }
    }
}

async function loadVaults() {
    if(state.loadingVaults) {
        return;
    }

    let previousSelectedVaultID = null;
    if(state.selectedVaultIndex !== null) {
        previousSelectedVaultID = state.vaults[state.selectedVaultIndex].id;
    }

    state.loadingVaults = true;
    state.vaults = [];
    state.selectedVaultIndex = null;
    update();

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.provider);

    const vaultCount = await contract.vaultCount();

    for(var i = 0; i < vaultCount; i += 1) {
        const existance = await contract.vaultExistance(i);

        if(existance) {
            const owner = await contract.vaultOwner(i);
            const collateral = await contract.vaultCollateral(i);
            const debt = await contract.vaultDebt(i);

            state.vaults.push({
                id: i,
                owner,
                collateral,
                debt
            });

            if(previousSelectedVaultID !== null && i == previousSelectedVaultID && state.selectedVaultIndex === null) {
                state.selectedVaultIndex = state.vaults.length - 1;
            }

            update();
        }
    }

    state.loadingVaults = false;
    update();
}

async function loadPrices() {
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.provider);

    const ethPriceSourceAddress = await contract.ethPriceSource();
    const ethPriceSource = new ethers.Contract(ethPriceSourceAddress, PriceSource.abi, state.provider);

    const tokenPriceSourceAddress = await contract.tokenPriceSource();
    const tokenPriceSource = new ethers.Contract(tokenPriceSourceAddress, PriceSource.abi, state.provider);

    const ethPrice = await ethPriceSource.getPrice();
    const tokenPrice = await tokenPriceSource.getPrice();

    state.ethPrice = ethPrice;
    state.tokenPrice = tokenPrice;
    update();
}

async function loadBalances() {
    const ethBalance = await state.provider.getBalance(state.address);

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    const tokenBalance = await contract.balanceOf(state.address);
    
    state.ethBalance = ethBalance;
    state.tokenBalance = tokenBalance;
    update();
}

async function createVault() {
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.createVault();

    loadVaults();
    loadPrices();
    loadBalances();
}

function onlyOwnedVaultsChange(e) {
    state.onlyOwnedVaults = e.target.checked;
    update();
}

function amountTextChange(e) {
    state.amountText = e.target.value;
    update();
}

function isAmountTextValid() {
    try {
        ethers.utils.parseEther(state.amountText.trim());

        return true;
    } catch(err) {
        return false;
    }
}

async function deposit(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.amountText.trim());
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
        amount = ethers.utils.parseEther(state.amountText.trim());
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
        amount = ethers.utils.parseEther(state.amountText.trim());
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
        amount = ethers.utils.parseEther(state.amountText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, Stablecoin.abi, state.signer);

    await contract.borrowToken(state.vaults[index].id, amount);

    loadVaults();
    loadPrices();
    loadBalances();
}

function selectVault(index) {
    state.selectedVaultIndex = index;
    update();
}

function vaultInfo(vault) {
    if(state.ethPrice !== null && state.tokenPrice !== null) {
        return `${vault.id} (${vault.owner}): ${ethers.utils.formatEther(vault.debt)}/${ethers.utils.formatEther(vault.collateral)} (${ethers.utils.formatEther(vault.debt.mul(state.tokenPrice))}/${ethers.utils.formatEther(vault.collateral.mul(state.ethPrice))})`;
    } else {
        return `${vault.id} (${vault.owner}): ${ethers.utils.formatEther(vault.debt)}/${ethers.utils.formatEther(vault.collateral)}`;
    }
}

function render() {
    return h('div', { className: 'container' }, [
        h('section', { className: 'section' },
            h('div', { className: 'container' }, 
                h('div', { className: 'level' }, [
                    state.address === null ?
                        h('button', { className: 'button', onclick: connect }, 'Connect') :
                        h('p', {},  state.address !== null ? state.address : 'Loading address...'),
                    h('div', {}, [
                        state.ethBalance !== null && state.tokenBalance !== null ?
                            h('p', {}, `Balance: ${ethers.utils.formatEther(state.ethBalance)} ETH, ${ethers.utils.formatEther(state.tokenBalance)} Token`) :
                            [],
                        state.ethPrice !== null && state.tokenPrice !== null ?
                            h('p', {}, `ETH price: ${ethers.utils.formatEther(state.ethPrice)}, Token price: ${ethers.utils.formatEther(state.tokenPrice)}`) :
                            []
                    ])
                ]),
                state.walletError !== null ?
                    h('p', { className: 'has-text-danger' }, state.walletError) :
                    [],
            )
        ),
        state.selectedVaultIndex !== null ? 
            h('section', { className: 'section' }, [
                h('h1', { className: 'title' }, `Vault #${state.vaults[state.selectedVaultIndex].id}`),
                h('div', { className: 'columns' }, [
                    h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Collateral'),
                    h('div', { className: 'column' }, `${ethers.utils.formatEther(state.vaults[state.selectedVaultIndex].collateral)} ETH`),
                    h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Debt'),
                    h('div', { className: 'column' }, `${ethers.utils.formatEther(state.vaults[state.selectedVaultIndex].debt)} Token`)
                ]),
                state.ethPrice !== null && state.tokenPrice !== null ?
                    h('div', { className: 'columns' }, [
                        h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Collateral Value'),
                        h('div', { className: 'column' }, `${ethers.utils.formatEther(state.vaults[state.selectedVaultIndex].collateral.mul(state.ethPrice))}`),
                        h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Debt Value'),
                        h('div', { className: 'column' }, `${ethers.utils.formatEther(state.vaults[state.selectedVaultIndex].debt.mul(state.tokenPrice))}`)
                    ]) :
                    [],
                h('div', {}, [
                    h('input', { type: 'text', className: `input space-bottom ${state.amountText === '' || isAmountTextValid() ? '' : 'is-danger'}`, placeholder: 'amount', value: state.amountText, oninput: amountTextChange }),
                    h('button', { className: 'button space-right', disabled: !isAmountTextValid(), onclick: () => deposit(state.selectedVaultIndex) }, 'Deposit ETH'),
                    h('button', { className: 'button space-right', disabled: !isAmountTextValid(), onclick: () => withdraw(state.selectedVaultIndex) }, 'Withdraw ETH'),
                    h('button', { className: 'button space-right', disabled: !isAmountTextValid(), onclick: () => payBack(state.selectedVaultIndex) }, 'Pay back token debt'),
                    h('button', { className: 'button', disabled: !isAmountTextValid(), onclick: () => borrow(state.selectedVaultIndex) }, 'Borrow token')
                ]),
            ]) :
            [],
        h('section', { className: 'section' }, [
            state.address !== null ?
                h('div', { className: 'level space-bottom'},
                    h('div', { className: 'level-left' }, [
                        h('button', { className: 'button space-right', onclick: createVault }, 'Create Vault'),
                        h('label', { className: 'checkbox' }, [
                            h('input', { type: 'checkbox', checked: state.onlyOwnedVaults, onchange: onlyOwnedVaultsChange }),
                            ' Only my vaults'
                        ])
                    ])
                ) :
                [],
            state.vaults.reduce((list, vault, index) => {
                if(state.address === null || !state.onlyOwnedVaults || vault.owner == state.address) {
                    list.push(h('div', { className: 'box' }, [
                        h('p', {}, vaultInfo(vault)),
                        state.address !== null && vault.owner === state.address ?
                            h('button', { className: 'button', disabled: state.selectedVaultIndex === index, onclick: () => selectVault(index) }, 'Select') :
                            []
                    ]));
                }

                return list;
            }, [])
        ])
    ]);
}

let state = {
    walletError: null,
    provider: process.env.NODE_ENV === 'production' ? ethers.getDefaultProvider(process.env.NETWORK) : new ethers.providers.JsonRpcProvider('http://localhost:8545'),
    signer: null,
    address: null,
    loadingVaults: false,
    onlyOwnedVaults: true,
    vaults: [],
    selectedVaultIndex: null,
    amountText: '',
    ethPrice: null,
    tokenPrice: null,
    ethBalance: null,
    tokenBalance: null
};
let tree = render();
let root = create(tree);
document.body.appendChild(root);

function update() {
    const newTree = render();

    const patches = diff(tree, newTree);
    root = patch(root, patches);

    tree = newTree;
}

loadVaults();
loadPrices();