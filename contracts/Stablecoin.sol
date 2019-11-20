pragma solidity ^0.5.2;

import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract Stablecoin is ERC20Detailed {
    constructor() ERC20Detailed("Stablecoin", "SBC", 18) public {

    }
}