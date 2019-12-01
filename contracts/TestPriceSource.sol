pragma solidity ^0.5.2;

import "./PriceSource.sol";

contract TestPriceSource is PriceSource {
    uint256 private _price;

    constructor(uint256 price) public {
        _price = price;
    }

    function getPrice() external view returns (uint256 price) {
        return _price;
    }

    function setPrice(uint256 price) external {
        uint256 oldPrice = _price;

        _price = price;

        emit ChangePrice(oldPrice, price);
    }
}