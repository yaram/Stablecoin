import { h, diff, patch, create } from 'virtual-dom';
import { ethers } from 'ethers';
import Stablecoin from '../build/Stablecoin.json';
import PriceSource from '../build/PriceSource.json';

const environment = process.env.NODE_ENV == null ? 'development' : process.env.NODE_ENV;
const contract_address = process.env.CONTRACT_ADDRESS;
const network = process.env.NETWORK;
const minimum_collateral_percentage = process.env.MINIMUM_COLLATERAL_PERCENTAGE;
const token_symbol = process.env.TOKEN_SYMBOL;
const target_symbol = process.env.TARGET_SYMBOL;

async function connect() {
    state.walletError = null;
    update();

    if(environment === 'production') {
        if(window.ethereum) {
                try {
                    const addresses = await window.ethereum.enable();
                    
                    const provider = new ethers.providers.Web3Provider(window.ethereum);
    
                    state.provider = provider;
                    state.signer = provider.getSigner();
                    state.address = ethers.utils.getAddress(addresses[0]);
                    update();
    
                    await loadBalances();
                    registerBalanceEventListeners();
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
                state.address = ethers.utils.getAddress(address);
                update();

                await loadBalances();
                registerBalanceEventListeners();
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
            state.address = ethers.utils.getAddress(address);
            update();

            await loadBalances();
            registerBalanceEventListeners();
        } catch(err) {
            state.walletError = 'Error connecting to development node';

            console.error(err);
        }
    }
}

async function loadVaults() {
    let previousSelectedVaultID = null;
    if(state.selectedVaultIndex !== null) {
        previousSelectedVaultID = state.vaults[state.selectedVaultIndex].id;
    }

    state.vaults = [];
    state.selectedVaultIndex = null;
    update();

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.provider);

    const vaultCount = await contract.vaultCount();

    for(var i = 0; i < vaultCount; i += 1) {
        const existance = await contract.vaultExistance(i);

        if(existance) {
            const owner = await contract.vaultOwner(i);
            const collateral = await contract.vaultCollateral(i);
            const debt = await contract.vaultDebt(i);

            state.vaults.push({
                id: ethers.utils.bigNumberify(i),
                owner,
                collateral,
                debt
            });

            if(previousSelectedVaultID !== null && previousSelectedVaultID.eq(i) && state.selectedVaultIndex === null) {
                state.selectedVaultIndex = state.vaults.length - 1;
            }

            update();
        }
    }
}

function registerVaultEventListeners() {
    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.provider);

    contract.on('CreateVault', (vaultID, creator) => {
        state.vaults.push({
            id: vaultID,
            owner: creator,
            collateral: ethers.constants.Zero,
            debt: ethers.constants.Zero
        });
        update();
    });

    contract.on('DestroyVault', (vaultID) => {
        for(let i = 0; i < state.vaults.length; i += 1) {
            if(state.vaults[i].id.eq(vaultID)) {
                state.vaults.splice(i, 1);

                if(state.selectedVaultIndex === i) {
                    state.selectedVaultIndex = null;
                }

                break;
            }
        }

        update();
    });

    contract.on('TransferVault', (vaultID, from, to) => {
        for(const vault of state.vaults) {
            if(vault.id.eq(vaultID)) {
                vault.owner = to;
                break;
            }
        }

        update();
    });

    contract.on('DepositCollateral', (vaultID, amount) => {
        for(const vault of state.vaults) {
            if(vault.id.eq(vaultID)) {
                vault.collateral = vault.collateral.add(amount);
                break;
            }
        }

        update();
    });

    contract.on('WithdrawCollateral', (vaultID, amount) => {
        for(const vault of state.vaults) {
            if(vault.id.eq(vaultID)) {
                vault.collateral = vault.collateral.sub(amount);
                break;
            }
        }

        update();
    });

    contract.on('BorrowToken', (vaultID, amount) => {
        for(const vault of state.vaults) {
            if(vault.id.eq(vaultID)) {
                vault.debt = vault.debt.add(amount);
                break;
            }
        }

        update();
    });

    contract.on('PayBackToken', (vaultID, amount) => {
        for(const vault of state.vaults) {
            if(vault.id.eq(vaultID)) {
                vault.debt = vault.debt.sub(amount);
                break;
            }
        }

        update();
    });

    contract.on('BuyRiskyVault', (vaultID, owner, buyer, amountPayed) => {
        for(const vault of state.vaults) {
            if(vault.id.eq(vaultID)) {
                vault.owner = buyer;
                vault.debt = vault.debt.sub(amountPayed);
                break;
            }
        }

        update();
    });
}

function registerBalanceEventListeners() {
    state.provider.on(state.address, (newBalance) => {
        state.ethBalance = newBalance;
        update();
    });

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.provider);

    contract.on('Transfer', (from, to, amount) => {
        if(from === state.address) {
            state.tokenBalance = state.tokenBalance.sub(amount);
        }

        if(to === state.address) {
            state.tokenBalance = state.tokenBalance.add(amount);
        }
        update();
    });
}

async function registerPriceEventListeners() {
    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.provider);

    const ethPriceSourceAddress = await contract.ethPriceSource();
    const ethPriceSource = new ethers.Contract(ethPriceSourceAddress, PriceSource.abi, state.provider);

    const tokenPriceSourceAddress = await contract.tokenPriceSource();
    const tokenPriceSource = new ethers.Contract(tokenPriceSourceAddress, PriceSource.abi, state.provider);

    ethPriceSource.on('ChangePrice', (oldPrice, newPrice) => {
        state.ethPrice = newPrice;
    });

    tokenPriceSource.on('ChangePrice', (oldPrice, newPrice) => {
        state.tokenPrice = newPrice;
    });
}

async function loadPrices() {
    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.provider);

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

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const tokenBalance = await contract.balanceOf(state.address);
    
    state.ethBalance = ethBalance;
    state.tokenBalance = tokenBalance;
    update();
}

async function createVault() {
    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.createVault();

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

function calculateCollateralPercentage(collateral, debt) {
    const collateralValueBig = collateral.mul(state.ethPrice);
    const debtValueBig = debt.mul(state.tokenPrice);

    const collateralPercentage = collateralValueBig.mul(100).div(debtValueBig);

    return collateralPercentage;
}

function onlyOwnedVaultsChange(e) {
    state.onlyOwnedVaults = e.target.checked;
    update();
}

function inputTextChange(e) {
    state.inputText = e.target.value;
    update();
}

async function deposit(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.inputText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.depositCollateral(state.vaults[index].id, { value: amount });

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

async function withdraw(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.inputText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.withdrawCollateral(state.vaults[index].id, amount);

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

async function payBack(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.inputText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.payBackToken(state.vaults[index].id, amount);

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

async function borrow(index) {
    let amount;
    try {
        amount = ethers.utils.parseEther(state.inputText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.borrowToken(state.vaults[index].id, amount);

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

async function buyRisky(index) {
    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.buyRiskyVault(state.vaults[index].id);

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

async function transfer(index) {
    let address;
    try {
        address = ethers.utils.getAddress(state.inputText.trim());
    } catch(err) {
        return;
    }

    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.transferVault(state.vaults[index].id, address);

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

async function destroyVault(index) {
    const contract = new ethers.Contract(contract_address, Stablecoin.abi, state.signer);

    const transaction = await contract.destroyVault(state.vaults[index].id);

    state.transactionHash = transaction.hash;
    update();

    try {
        await transaction.wait();
    } catch(err) {

    }

    state.transactionHash = null;
    update();
}

function selectVault(index) {
    state.selectedVaultIndex = index;
    update();
}

function changeTab(tab) {
    state.tab = tab;
    update();
}

function selectedVaultDisplay() {
    const vault = state.vaults[state.selectedVaultIndex];

    const parts = [];

    parts.push(
        h('div', { className: 'level' },
            h('div', { className: 'level-left'}, [
                h('h1', { className: 'title level-item space-only-right' }, `Vault #${vault.id}`),
                h('p', { className: 'level-item' }, vault.owner)
            ])
        ),
        h('div', { className: 'columns' }, [
            h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Collateral'),
            h('div', { className: 'column' }, `${ethers.utils.formatEther(vault.collateral)} ETH`),
            h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Debt'),
            h('div', { className: 'column' }, `${ethers.utils.formatEther(vault.debt)} ${token_symbol}`)
        ]),
    );

    if(state.ethPrice !== null && state.tokenPrice !== null) {
        const collateralValueBig = vault.collateral.mul(state.ethPrice);
        const debtValueBig = vault.debt.mul(state.tokenPrice);

        parts.push(
            h('div', { className: 'columns' }, [
                h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Collateral Value'),
                h('div', { className: 'column' }, `${ethers.utils.formatEther(collateralValueBig.div(ethers.constants.WeiPerEther))} ${target_symbol}`),
                h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Debt Value'),
                h('div', { className: 'column' }, `${ethers.utils.formatEther(debtValueBig.div(ethers.constants.WeiPerEther))} ${target_symbol}`)
            ]),
        );

        let debtRatioDisplay;
        if(!debtValueBig.eq(0)) {
            const debtRatio = collateralValueBig.mul(100).div(debtValueBig);

            if(debtRatio.gte(minimum_collateral_percentage)) {
                debtRatioDisplay = h('div', { className: 'column'}, `${debtRatio}%`);
            } else {
                debtRatioDisplay = h('div', { className: 'column has-text-danger'}, `${debtRatio}%`);
            }
        } else {
            debtRatioDisplay = h('div', { className: 'column'}, '\u221e');
        }

        const maximumDebtValueBig = collateralValueBig.mul(100).div(minimum_collateral_percentage);

        const maximumDebt = maximumDebtValueBig.div(state.tokenPrice);

        const debtDifference = maximumDebt.sub(vault.debt);

        let debtDifferenceLabel;
        let debtDifferenceText;
        if(debtDifference.gte(0)) {
            debtDifferenceLabel = 'Available to Borrow';
            debtDifferenceText = ethers.utils.formatEther(debtDifference);
        } else {
            debtDifferenceLabel = 'Needed to Pay Back';
            debtDifferenceText = ethers.utils.formatEther(ethers.constants.Zero.sub(debtDifference));
        }

        parts.push(
            h('div', { className: 'columns' }, [
                h('div', { className: 'column has-text-right has-text-weight-bold' }, 'Collateral to Debt Ratio'),
                debtRatioDisplay,
                h('div', { className: 'column has-text-right has-text-weight-bold' }, debtDifferenceLabel),
                h('div', { className: 'column' }, `${debtDifferenceText} ${token_symbol}`)
            ])
        );
    }

    if(state.address !== null) {
        if(vault.owner === state.address) {
            parts.push(
                h('div', { className: 'tabs' }, [
                    h('ul', {}, [
                        h('li', { className: state.tab === 'deposit' ? 'is-active' : null, onclick: () => changeTab('deposit') }, h('a', {}, 'Deposit')),
                        h('li', { className: state.tab === 'withdraw' ? 'is-active' : null, onclick: () => changeTab('withdraw')  }, h('a', {}, 'Withdraw')),
                        h('li', { className: state.tab === 'borrow' ? 'is-active' : null, onclick: () => changeTab('borrow')  }, h('a', {}, 'Borrow')),
                        h('li', { className: state.tab === 'payBack' ? 'is-active' : null, onclick: () => changeTab('payBack')  }, h('a', {}, 'Pay Back')),
                        h('li', { className: state.tab === 'transfer' ? 'is-active' : null, onclick: () => changeTab('transfer')  }, h('a', {}, 'Transfer')),
                        h('li', { className: state.tab === 'destroy' ? 'is-active' : null, onclick: () => changeTab('destroy')  }, h('a', {}, 'Destroy'))
                    ])
                ])
            );

            if(state.tab === 'deposit') {
                let isInputTextValid = true;
                try {
                    const amount = ethers.utils.parseEther(state.inputText.trim());

                    if(amount.gt(0)) {
                        if(state.ethBalance !== null && amount.gt(state.ethBalance)) {
                            isInputTextValid = false;
                        }
                    } else {
                        isInputTextValid = false;
                    }
                } catch(err) {
                    isInputTextValid = false;
                }

                parts.push(
                    h('input', {
                        type: 'text',
                        className: `input space-bottom ${state.inputText === '' || isInputTextValid ? '' : 'is-danger'}`,
                        placeholder: 'amount of ETH to deposit',
                        value: state.inputText, oninput: inputTextChange
                    }),
                    h('div', {}, [
                        h('button', { className: 'button', disabled: !isInputTextValid || state.transactionHash !== null, onclick: () => deposit(state.selectedVaultIndex) }, 'Deposit ETH'),
                    ])
                );
            } else if(state.tab === 'withdraw') {
                let isInputTextValid = true;
                try {
                    const amount = ethers.utils.parseEther(state.inputText.trim());

                    if(amount.gt(0) && amount.lte(vault.collateral)) {
                        if(!vault.debt.eq(0) && state.ethPrice !== null && state.tokenPrice !== null) {
                            const newCollateralPercentage = calculateCollateralPercentage(vault.collateral.sub(amount), vault.debt);

                            if(newCollateralPercentage.lt(minimum_collateral_percentage)) {
                                isInputTextValid = false;
                            }
                        }
                    } else {
                        isInputTextValid = false;
                    }
                } catch(err) {
                    isInputTextValid = false;
                }

                parts.push(
                    h('input', {
                        type: 'text',
                        className: `input space-bottom ${state.inputText === '' || isInputTextValid ? '' : 'is-danger'}`,
                        placeholder: 'amount of ETH to withdraw',
                        value: state.inputText, oninput: inputTextChange
                    }),
                    h('div', {}, [
                        h('button', { className: 'button', disabled: !isInputTextValid || state.transactionHash !== null, onclick: () => withdraw(state.selectedVaultIndex) }, 'Withdraw ETH'),
                    ])
                );
            } else if(state.tab === 'borrow') {
                let isInputTextValid = true;
                try {
                    const amount = ethers.utils.parseEther(state.inputText.trim());

                    if(amount.gt(0)) {
                        if(state.ethPrice !== null && state.tokenPrice !== null) {
                            const newCollateralPercentage = calculateCollateralPercentage(vault.collateral, vault.debt.add(amount));

                            if(newCollateralPercentage.lt(minimum_collateral_percentage)) {
                                isInputTextValid = false;
                            }
                        }
                    } else {
                        isInputTextValid = false;
                    }
                } catch(err) {
                    isInputTextValid = false;
                }

                parts.push(
                    h('input', {
                        type: 'text',
                        className: `input space-bottom ${state.inputText === '' || isInputTextValid ? '' : 'is-danger'}`,
                        placeholder: `amount of ${token_symbol} to borrow`,
                        value: state.inputText, oninput: inputTextChange
                    }),
                    h('div', {}, [
                        h('button', { className: 'button', disabled: !isInputTextValid || state.transactionHash !== null, onclick: () => borrow(state.selectedVaultIndex) }, `Borrow ${token_symbol}`),
                    ])
                );
            } else if(state.tab === 'payBack') {
                let isInputTextValid = true;
                try {
                    const amount = ethers.utils.parseEther(state.inputText.trim());

                    if(amount.gt(0)) {
                        if(state.tokenBalance !== null && amount.gt(state.tokenBalance)) {
                            isInputTextValid = false;
                        }
                    } else {
                        isInputTextValid = false;
                    }
                } catch(err) {
                    isInputTextValid = false;
                }

                parts.push(
                    h('input', {
                        type: 'text',
                        className: `input space-bottom ${state.inputText === '' || isInputTextValid ? '' : 'is-danger'}`,
                        placeholder: `amount of ${token_symbol} to pay back`,
                        value: state.inputText, oninput: inputTextChange
                    }),
                    h('div', {}, [
                        h('button', { className: 'button', disabled: !isInputTextValid || state.transactionHash !== null, onclick: () => payBack(state.selectedVaultIndex) }, `Pay Back ${token_symbol}`),
                    ])
                );
            } else if(state.tab === 'transfer') {
                let isInputTextValid = true;
                try {
                    const address = ethers.utils.getAddress(state.inputText.trim());

                    if(address === ethers.constants.AddressZero) {
                        isInputTextValid = false;
                    }
                } catch(err) {
                    isInputTextValid = false;
                }

                parts.push(
                    h('input', {
                        type: 'text',
                        className: `input space-bottom ${state.inputText === '' || isInputTextValid ? '' : 'is-danger'}`,
                        placeholder: 'address to transfer to',
                        value: state.inputText, oninput: inputTextChange
                    }),
                    h('div', {}, [
                        h('button', { className: 'button is-danger', disabled: !isInputTextValid || state.transactionHash !== null, onclick: () => transfer(state.selectedVaultIndex) }, 'Transfer vault'),
                    ])
                );
            } else if(state.tab === 'destroy') {
                parts.push(
                    h('div', {}, [
                        h('button', { className: 'button is-danger', disabled: !vault.debt.eq(0) || state.transactionHash !== null, onclick: () => destroyVault(state.selectedVaultIndex) }, 'Destroy vault'),
                    ])
                );
            }
        } else {
            let canBuyRiskyVault = true;
            if(!vault.debt.eq(0)) {
                if(state.ethPrice !== null && state.tokenPrice !== null) {
                    const collateralValueBig = vault.collateral.mul(state.ethPrice);
                    const debtValueBig = vault.debt.mul(state.tokenPrice);

                    const collateralPercentage = collateralValueBig.mul(100).div(debtValueBig);

                    if(collateralPercentage.lt(minimum_collateral_percentage)) {
                        if(state.tokenBalance !== null) {
                            const maximumDebtValueBig = collateralValueBig.mul(100).div(minimum_collateral_percentage);
                    
                            const maximumDebt = maximumDebtValueBig.div(state.tokenPrice);
                    
                            const debtDifference = vault.debt.sub(maximumDebt);

                            if(debtDifference.gt(state.tokenBalance)) {
                                canBuyRiskyVault = false;
                            }
                        }
                    } else {
                        canBuyRiskyVault = false;
                    }
                }
            } else {
                canBuyRiskyVault = false;
            }

            if(state.transactionHash !== null) {
                canBuyRiskyVault = false;
            }

            parts.push(
                h('button', { className: 'button', disabled: !canBuyRiskyVault, onclick: () => buyRisky(state.selectedVaultIndex) }, 'Buy risky vault')
            );
        }
    }

    return h('section', { className: 'section' }, parts);
}

function render() {
    return h('div', {}, [
        h('div', { className: 'container' }, [
            h('section', { className: 'section' },
                h('div', { className: 'container' }, 
                    h('div', { className: 'level' }, [
                        state.address === null ?
                            h('button', { className: 'button level-left', onclick: connect }, 'Connect') :
                            h('p', { className: 'level-left' },  state.address !== null ? state.address : 'Loading address...'),
                        h('div', { className: 'level-right'},
                            h('div', { className: 'level-item'}, [
                                h('div', { className: 'balance-price' }, [
                                    state.ethBalance !== null && state.tokenBalance !== null ?
                                        h('div', {}, `Balance: ${ethers.utils.formatEther(state.ethBalance)} ETH, ${ethers.utils.formatEther(state.tokenBalance)} ${token_symbol}`) :
                                        [],
                                    state.ethPrice !== null && state.tokenPrice !== null ?
                                        h('div', {}, `Prices: ${ethers.utils.formatEther(state.ethPrice)} ${target_symbol}/ETH, ${ethers.utils.formatEther(state.tokenPrice)} ${target_symbol}/${token_symbol}`) :
                                        []
                                ])
                            ])
                        )
                    ]),
                    state.walletError !== null ?
                        h('p', { className: 'has-text-danger' }, state.walletError) :
                        [],
                )
            ),
            state.selectedVaultIndex !== null ? 
                selectedVaultDisplay() :
                [],
            h('section', { className: 'section' }, [
                h('h1', { className: 'title' }, 'Vaults'),
                state.address !== null ?
                    h('div', { className: 'level space-bottom'},
                        h('div', { className: 'level-left' }, [
                            h('button', { className: 'button space-right level-item', disabled: state.transactionHash !== null, onclick: createVault }, 'Create Vault'),
                            h('div', { className: 'level-item' },
                                h('label', { className: 'checkbox' }, [
                                    h('input', { type: 'checkbox', checked: state.onlyOwnedVaults, onchange: onlyOwnedVaultsChange }),
                                    ' Only my vaults'
                                ])
                            )
                        ])
                    ) :
                    [],
                state.vaults.reduce((list, vault, index) => {
                    if(state.address === null || !state.onlyOwnedVaults || vault.owner === state.address) {
                        const parts = [];

                        parts.push(
                            h('div', { className: 'columns' }, [
                                h('div', { className: 'column'}, `#${vault.id}`),
                                h('div', { className: 'column'}, `${ethers.utils.formatEther(vault.collateral)} ETH`),
                                h('div', { className: 'column'}, `${ethers.utils.formatEther(vault.debt)} ${token_symbol}`)
                            ])
                        );

                        if(state.ethPrice !== null && state.tokenPrice !== null) {
                            const debtValue = vault.debt.mul(state.tokenPrice).div(ethers.constants.WeiPerEther);
                            const collateralValue = vault.collateral.mul(state.ethPrice).div(ethers.constants.WeiPerEther);

                            let debtRatioDisplay;
                            if(!debtValue.eq(0)) {
                                const debtRatio = collateralValue.mul(100).div(debtValue);

                                if(debtRatio.gte(minimum_collateral_percentage)) {
                                    debtRatioDisplay = h('div', { className: 'column'}, `${debtRatio}%`);
                                } else {
                                    debtRatioDisplay = h('div', { className: 'column has-text-danger'}, `${debtRatio}%`);
                                }
                            } else {
                                debtRatioDisplay = h('div', { className: 'column'}, '');
                            }

                            parts.push(
                                h('div', { className: 'columns' }, [
                                    debtRatioDisplay,
                                    h('div', { className: 'column'}, `${ethers.utils.formatEther(collateralValue)} ${target_symbol}`),
                                    h('div', { className: 'column'}, `${ethers.utils.formatEther(debtValue)} ${target_symbol}`)
                                ])
                            );
                        }

                        list.push(
                            h('div', { className: 'box is-size-7 has-text-weight-bold' }, [
                                parts,
                                h('button', { className: 'button', disabled: state.selectedVaultIndex === index, onclick: () => selectVault(index) }, 'Select')
                            ])
                        );
                    }

                    return list;
                }, [])
            ])
        ]),
        state.transactionHash !== null ?
            h('article', { className: 'message transaction-message' },
                h('div', { className: 'message-body'}, `Waiting for confirmation of transaction ${state.transactionHash}`)
            ) :
            []
    ]);
}

let state = {
    walletError: null,
    provider: environment === 'production' ? ethers.getDefaultProvider(network) : new ethers.providers.JsonRpcProvider('http://localhost:8545'),
    signer: null,
    address: null,
    transactionHash: null,
    onlyOwnedVaults: true,
    vaults: [],
    selectedVaultIndex: null,
    inputText: '',
    tab: 'deposit',
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
registerVaultEventListeners();
loadPrices();
registerPriceEventListeners();