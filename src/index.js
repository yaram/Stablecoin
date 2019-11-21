import { h, diff, patch, create } from 'virtual-dom';
import { ethers } from 'ethers';

async function connect(state) {
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

function render(state) {
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
        ])
    ]);
}

let tree = render({
    message: null,
    provider: process.env.NODE_ENV === 'production' ? ethers.getDefaultProvider() : new ethers.providers.JsonRpcProvider('http://localhost:8545'),
    signer: null,
    address: null,
    vaults: []
});
let root = create(tree);
document.body.appendChild(root);

function update(state) {
    const newTree = render(state);
    const patches = diff(tree, newTree);
    root = patch(root, patches);
    tree = newTree;
}