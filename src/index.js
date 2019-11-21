import { h, app } from 'hyperapp';

app({
    init: {},
    view: state => h('div', {}, ['test']),
    node: document.getElementById('app')
});