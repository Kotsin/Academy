//SPDX-License-Identifier: Unlicense
pragma solidity =0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Staking {
    using SafeERC20 for IERC20Metadata;

    struct User {
        uint256 amount;
        uint256 depositTime;
        bool claimed;
    }

    //100%
    uint256 public constant HUNDRED_PERCENT = 10000;

    //sc owner
    address public owner;

    //address of a staking token
    IERC20Metadata public stakingToken;

    //address of a reward token
    IERC20Metadata public rewardToken;

    //amount of tokens left that can be staked
    uint256 public tokensLeft;
    //percentage
    uint256 public percentage;
    //staking start time
    uint256 public startTime;
    //duration of an epoch in seconds
    uint256 public epochDuration;
    //amount of epochs
    uint256 public amountOfEpochs;
    //shows if staking was already initialized
    bool public initialized;

    //mapping for users
    mapping(address => User) public users;

    event Deposited(address _address, uint256 _amount);
    event Withdrawn(address _address);
    event Claimed(address _address, uint256 _amount);

    constructor(address _stakingToken, address _rewardToken) {
        owner = msg.sender;
        stakingToken = IERC20Metadata(_stakingToken);
        rewardToken = IERC20Metadata(_rewardToken);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not an owner");
        _;
    }

    function initialize(
        uint256 _totalAmount,
        uint256 _percentage,
        uint256 _epochDuration,
        uint256 _amountOfEpochs,
        uint256 _startTime
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        tokensLeft = _totalAmount;
        percentage = _percentage;
        startTime = _startTime;
        amountOfEpochs = _amountOfEpochs;
        epochDuration = _epochDuration;
        initialized = true;
        rewardToken.safeTransferFrom(
            msg.sender,
            address(this),
            ((_totalAmount * _percentage * _amountOfEpochs) / HUNDRED_PERCENT)
        );
    }

    function deposit(uint256 _amount) external {
        require(startTime <= block.timestamp, "Staking is not up yet");
        require(_amount <= tokensLeft, "Too many tokens contributed");
        users[msg.sender] = User({
            amount: _amount,
            depositTime: block.timestamp,
            claimed: false
        });
        tokensLeft -= _amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposited(msg.sender, _amount);
    }

    function withdraw() external {
        User memory user = users[msg.sender];
        require(user.amount > 0, "nothing to withdraw");
        require(user.claimed, "not claimed yet");
        users[msg.sender].amount = 0;
        stakingToken.safeTransfer(msg.sender, user.amount);
        emit Withdrawn(msg.sender);
    }

    function claimRewards() external {
        User memory user = users[msg.sender];
        require(
            user.depositTime + epochDuration * amountOfEpochs <=
                block.timestamp,
            "too early to claim"
        );
        require(!user.claimed, "already claimed");
        users[msg.sender].claimed = true;
        uint256 amount = (user.amount * percentage * (amountOfEpochs)) /
            HUNDRED_PERCENT;
        rewardToken.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
