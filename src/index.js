import { h, app } from 'hyperapp';
import { ethers } from 'ethers';

function retrieveAddress(dispatch, signer) {
    signer.getAddress().then(address => dispatch(state => ({ ...state, address })));
}

function Connect(state) {
    if(process.env.NODE_ENV === 'production') {
        if(window.ethereum) {
            return [
                { ...state, message: null },
                [
                    dispatch => {
                        window.ethereum.enable().then(addresses => {
                            const provider = new ethers.providers.Web3Provider(window.ethereum);

                            dispatch(state => ({
                                ...state,
                                provider,
                                signer: provider.getSigner(),
                                address: addresses[0]
                            }));
                        }).catch(() => dispatch(state => ({ ...state, message: 'Unable to connect to wallet'})))
                    }
                ]
            ];
        } else if(window.web3) {
            const provider = new ethers.providers.Web3Provider(window.web3.currentProvider);
            const signer = provider.getSigner();

            return [
                {
                    ...state,
                    message: null,
                    provider,
                    signer
                },
                [
                    retrieveAddress,
                    signer
                ]
            ];
        } else {
            return {
                ...state,
                message: null,
                provider: ethers.getDefaultProvider()
            };
        }
    } else {
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        const signer = provider.getSigner();

        return [
            {
                ...state,
                message: null,
                provider,
                signer
            },
            [
                retrieveAddress,
                signer
            ]
        ];
    }
}

app({
    init: {
        message: null,
        provider: null,
        signer: null,
        address: null
    },
    view: state => h('div', {}, [
        state.message !== null ?
            h('div', {}, [state.message]) :
            [],
        h('div', {},
            state.provider === null ?
            h('button', { onClick: Connect }, ['Connect']):
            [
                h('div', {}, ['Connected to provider']),
                h('div', {},  state.address !== null ?
                    state.address :
                    'Loading address...'
                )
            ]
        )
    ]),
    node: document.getElementById('app')
});