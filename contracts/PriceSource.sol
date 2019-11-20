pragma solidity ^0.5.2;

interface PriceSource {
    function getPrice() external view returns (uint256 price);
}