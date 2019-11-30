pragma solidity ^0.5.2;

import "./Stablecoin.sol";

contract TestStablecoin is Stablecoin {
    constructor(
        address ethPriceSourceAddress,
        address tokenPriceSourceAddress,
        uint256 minimumCollateralPercentage,
        string memory name,
        string memory symbol
    ) Stablecoin(
        ethPriceSourceAddress,
        tokenPriceSourceAddress,
        minimumCollateralPercentage,
        name,
        symbol
    ) public {

    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}