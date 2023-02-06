pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract IDO is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    struct VestingRule {
        uint256 unlockTime; //Number of block which give ability to claim reward tokens
        uint256 unlockPercent; //Number of opened percent
    }

    struct User {
        uint256 claimed;
        uint256 bought;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint256 public constant PRECISION = 100000;

    uint256 public immutable startTime; // IDO sale phase start time
    uint256 public immutable endTime; // IDO sale phase end time
    uint256 public immutable price; // Price of one TST token in USD, e.g. 200000 means 2 usdc per 1 tst
    uint256 public immutable minAmount; // Min purchase amount in TST
    uint256 public immutable maxAmount; // Max purchase amount in TST
    uint256 public goal; // After reaching this mark, IDO stops
    uint256 public totalUSDCAccumulated; // Amount of USDC collected
    uint256 public totalTSTSold; // Amount of TST reserved for claim

    address public immutable usdc; // The address of the USD Coin contract
    address public immutable tst; // Address of the TST Token contract

    VestingRule[] public vesting; //Array of struct Vesting rule which contain info about vesting in this campaign

    // Users[user's address] -> TST Coin's amount bought and amount claimed
    mapping(address => User) public users;

    event Participated(
        uint256 amountOut,
        uint256 totalUSDCAccumulated,
        address user
    );

    event Claimed(address user, uint256 tstAmount);

    event CampaignFinished(
        address recipient,
        uint256 amountUSDC,
        uint256 remainingTST
    );

    constructor(
        uint256 _startTime,
        uint256 _endTime,
        address _tst,
        address _usdc,
        uint256 _price,
        uint256 _minAmount,
        uint256 _maxAmount,
        VestingRule[] memory _vesting
    ) {
        startTime = _startTime;
        endTime = _endTime;
        tst = _tst;
        usdc = _usdc;
        price = _price;
        minAmount = _minAmount;
        maxAmount = _maxAmount;
        uint256 totalPercent;
        for (uint128 i; i < _vesting.length; i++) {
            require(_vesting[i].unlockTime > _endTime, "bad unlockTime");
            vesting.push(_vesting[i]);
            totalPercent += _vesting[i].unlockPercent;
        }
        require(totalPercent == PRECISION, "bad vesting rules");

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "not an admin");
        _;
    }

    /**
     * @dev initializes IDO goal
     *
     * @param _goal IDO goal in USDC
     */ 
    function initialize(uint256 _goal) external onlyAdmin {
        require(goal == 0, "already initialized");
        goal = _goal;
        IERC20Metadata(tst).safeTransferFrom(
            msg.sender,
            address(this),
            (_goal * PRECISION * IERC20Metadata(tst).decimals()) /
                (price * IERC20Metadata(usdc).decimals())
        );
    }

    /**
     * @dev Function to participate in IDO
     *
     * @param _amount The amount of TST
     */
    function buyToken(uint256 _amount) external nonReentrant {
        require(block.timestamp > startTime, "too early");
        require(block.timestamp < endTime, "too late");
        require(_amount >= minAmount && users[msg.sender].bought + _amount <= maxAmount, "bad amount");
        uint256 usdcAmount = ((_amount *
            (10**IERC20Metadata(usdc).decimals()) *
            price) / (PRECISION * (10**IERC20Metadata(tst).decimals())));
        require(totalUSDCAccumulated + usdcAmount <= goal, "amount too high.");
        totalUSDCAccumulated += usdcAmount;
        users[msg.sender].bought += _amount;
        totalTSTSold += _amount;
        IERC20Metadata(usdc).safeTransferFrom(
            msg.sender,
            address(this),
            usdcAmount
        );
        emit Participated(_amount, totalUSDCAccumulated, msg.sender);
    }

    /**
     * @dev Function to claim the user's share after completing the IDO
     */
    function withdrawTokens() external {
        require(block.timestamp > endTime, "too early");
        User storage user = users[msg.sender];
        require(user.bought - (user.claimed) > 0, "nothing to claim");

        uint256 amount = getAvailableAmount(msg.sender);

        user.claimed += amount;

        IERC20Metadata(tst).safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /**
     * @dev Function for transferring collected USD Coins to the beneficiary address after IDO
     */
    function withdrawUSDC() external onlyAdmin {
        require(block.timestamp > endTime, "too early");
        uint256 balanceUSDC = IERC20Metadata(usdc).balanceOf(address(this));
        uint256 tstRemaining = IERC20Metadata(tst).balanceOf(address(this)) -
            totalTSTSold;
        if (balanceUSDC > 0) {
            IERC20Metadata(usdc).safeTransfer(msg.sender, balanceUSDC);
        }
        if (tstRemaining > 0) {
            IERC20Metadata(tst).safeTransfer(msg.sender, tstRemaining);
        }
        emit CampaignFinished(msg.sender, balanceUSDC, tstRemaining);
    }

    /** @notice Calculate available percent to claim from vesting rules.
     */
    function getAvailableAmount(address _address)
        public
        view
        returns (uint256)
    {
        User memory user = users[_address];
        require(vesting[0].unlockTime <= block.timestamp, "Time have not came");

        uint256 availablePercent;
        for (uint256 i = 0; i < vesting.length; i++) {
            if (vesting[i].unlockTime <= block.timestamp) {
                availablePercent += vesting[i].unlockPercent;
                continue;
            }
            break;
        }
        return ((user.bought * availablePercent) / PRECISION) - user.claimed;
    }
}
