pragma solidity =0.8.17;

import "../IDO.sol";

contract IDOMock is IDO {
    constructor(
        uint256 _startTime,
        uint256 _endTime,
        address _tst,
        address _usdc,
        uint256 _price,
        uint256 _minAmount,
        uint256 _maxAmount,
        VestingRule[] memory _vesting
    )
        IDO(
            _startTime,
            _endTime,
            _tst,
            _usdc,
            _price,
            _minAmount,
            _maxAmount,
            _vesting
        )
    {}

    function setStartTime(uint256 _startTime) external {
        startTime = _startTime;
    }
}
