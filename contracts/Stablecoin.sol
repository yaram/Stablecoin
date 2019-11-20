pragma solidity ^0.5.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "./PriceSource.sol";

contract Stablecoin is ERC20, ERC20Detailed {
    PriceSource private _ethPriceSource;
    PriceSource private _tokenPriceSource;

    uint256 private _minimumCollateralPercentage;

    uint256 private _nextVaultID;

    mapping(uint256 => bool) vaultExistance;
    mapping(uint256 => address) vaultOwner;
    mapping(uint256 => uint256) vaultCollateral;
    mapping(uint256 => uint256) vaultDebt;

    mapping(address => uint256[]) ownerVaults;

    constructor(
        address ethPriceSource,
        address tokenPriceSource,
        uint256 minimumCollateralPercentage,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20Detailed(name, symbol, decimals) public {
        assert(ethPriceSource != address(0));
        assert(tokenPriceSource != address(0));
        assert(minimumCollateralPercentage != 0);

        _ethPriceSource = PriceSource(ethPriceSource);
        _tokenPriceSource = PriceSource(tokenPriceSource);
        _minimumCollateralPercentage = minimumCollateralPercentage;
    }

    modifier onlyVaultOwner(uint256 vaultID) {
        require(vaultExistance[vaultID], "Vault does not exist");
        require(vaultOwner[vaultID] == msg.sender, "Vault is not owned by you");
        _;
    }

    function isValidCollateral(uint256 collateral, uint256 debt) private view returns (bool) {
        uint256 collateralPrice = collateral * _ethPriceSource.getPrice();

        assert(collateralPrice > collateral);

        uint256 debtPrice = debt * _tokenPriceSource.getPrice();

        assert(debtPrice > debt);

        uint256 collateralPriceTimes100 = collateralPrice * 100;

        assert(collateralPriceTimes100 > collateralPrice);

        uint256 collateralPercentage = collateralPriceTimes100 / debtPrice;

        return collateralPercentage >= _minimumCollateralPercentage;
    }

    function createVault() external returns (uint256) {
        uint256 id = _nextVaultID;
        _nextVaultID += 1;

        assert(_nextVaultID > id);

        vaultExistance[id] = true;
        vaultOwner[id] = msg.sender;

        ownerVaults[msg.sender].push(id);

        return id;
    }

    function destroyVault(uint256 vaultID) external onlyVaultOwner(vaultID) {
        require(vaultDebt[vaultID] != 0, "Vault has outstanding debt");

        if(vaultCollateral[vaultID] > 0) {
            msg.sender.transfer(vaultCollateral[vaultID]);
        }

        delete vaultExistance[vaultID];
        delete vaultOwner[vaultID];
        delete vaultCollateral[vaultID];
        delete vaultDebt[vaultID];
    }

    function transferVault(uint256 vaultID, address to) external onlyVaultOwner(vaultID) {
        vaultOwner[vaultID] = to;
    }

    function depositCollateral(uint256 vaultID) external payable onlyVaultOwner(vaultID) {
        uint256 newCollateral = vaultCollateral[vaultID] + msg.value;

        assert(newCollateral > vaultCollateral[vaultID]);

        vaultCollateral[vaultID] = newCollateral;
    }

    function withdrawCollateral(uint256 vaultID, uint256 amount) external onlyVaultOwner(vaultID) {
        require(vaultCollateral[vaultID] >= amount, "Vault does not have enough collateral");

        uint256 newCollateral = vaultCollateral[vaultID] - amount;

        if(vaultDebt[vaultID] != 0) {
            require(isValidCollateral(newCollateral, vaultDebt[vaultID]), "Withdrawal would put vault below minimum collateral percentage");
        }

        vaultCollateral[vaultID] = newCollateral;
        msg.sender.transfer(amount);
    }

    function borrowToken(uint256 vaultID, uint256 amount) external onlyVaultOwner(vaultID) {
        require(amount > 0, "Must borrow non-zero amount");

        uint256 newDebt = vaultDebt[vaultID] + amount;

        assert(newDebt > vaultDebt[vaultID]);

        require(isValidCollateral(vaultCollateral[vaultID], newDebt), "Borrow would put vault below minimum collateral percentage");

        vaultDebt[vaultID] = newDebt;
        _mint(msg.sender, amount);
    }

    function payBackToken(uint256 vaultID, uint256 amount) external onlyVaultOwner(vaultID) {
        require(balanceOf(msg.sender) >= amount, "Token balance too low");
        require(vaultDebt[vaultID] >= amount, "Vault debt less than amount to pay back");

        vaultDebt[vaultID] -= amount;
        _burn(msg.sender, amount);
    }

    function buyRiskyVault(uint256 vaultID) external {
        require(vaultExistance[vaultID], "Vault does not exist");

        uint256 collateralPrice = vaultCollateral[vaultID] * _ethPriceSource.getPrice();

        assert(collateralPrice > vaultCollateral[vaultID]);

        uint256 debtPrice = vaultDebt[vaultID] * _tokenPriceSource.getPrice();

        assert(debtPrice > vaultDebt[vaultID]);

        uint256 collateralPriceTimes100 = collateralPrice * 100;

        assert(collateralPriceTimes100 > collateralPrice);

        uint256 collateralPercentage = collateralPriceTimes100 / debtPrice;

        require(collateralPercentage < _minimumCollateralPercentage, "Vault is not below minimum collateral percentage");

        uint256 maximumDebtPrice = collateralPriceTimes100 / _minimumCollateralPercentage;

        uint256 maximumDebt = maximumDebtPrice / _tokenPriceSource.getPrice();

        uint256 debtDifference = vaultDebt[vaultID] - maximumDebt;

        require(balanceOf(msg.sender) >= debtDifference, "Token balance too low to pay off outstanding debt");

        vaultOwner[vaultID] = msg.sender;
        vaultDebt[vaultID] = maximumDebt;
        _burn(msg.sender, debtDifference);
    }
}