import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { MyToken, Staking } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// variables
let stakingToken: MyToken;
let rewardToken: MyToken;
let staking: Staking;
let owner: SignerWithAddress;
let accounts: SignerWithAddress[];

// constants
const totalAmount = ethers.utils.parseEther("1000");
const percentage = 1000;
const HUNDRED_PERCENT = 10000;
const epochDuration = 2592000;
const amountOfEpochs = 3;

describe("Staking", function () {
  async function deployFixture() {
    [owner, ...accounts] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MyToken");
    stakingToken = await Token.deploy();
    rewardToken = await Token.deploy();
    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(stakingToken.address, rewardToken.address);
    await staking.deployed();

    for (let i = 0; i < 10; i++) {
      await stakingToken.mint(
        accounts[0].address,
        ethers.utils.parseEther("100")
      );
    }
  }

  async function deployInitFixture() {
    const Token = await ethers.getContractFactory("MyToken");
    stakingToken = await Token.deploy();
    rewardToken = await Token.deploy();
    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(stakingToken.address, rewardToken.address);
    await staking.deployed();

    await rewardToken
      .connect(owner)
      .approve(
        staking.address,
        totalAmount.mul(percentage).mul(amountOfEpochs).div(HUNDRED_PERCENT)
      );
    const startTime = (await time.latest()) + 100;
    await staking
      .connect(owner)
      .initialize(
        totalAmount,
        percentage,
        epochDuration,
        amountOfEpochs,
        startTime
      );

    for (let i = 0; i < 10; i++) {
      await stakingToken.mint(
        accounts[i].address,
        ethers.utils.parseEther("100")
      );
    }
  }
  describe("Initialize", () => {
    it("Should be only callable by owner", async () => {
      await loadFixture(deployFixture);
      const startTime = (await time.latest()) + 100;
      await rewardToken
        .connect(accounts[0])
        .approve(
          staking.address,
          totalAmount.mul(percentage).mul(amountOfEpochs).div(HUNDRED_PERCENT)
        );
      await expect(
        staking
          .connect(accounts[0])
          .initialize(
            totalAmount,
            percentage,
            epochDuration,
            amountOfEpochs,
            startTime
          )
      ).to.be.revertedWith("Not an owner");
    });

    it("Should be initialized correctly", async () => {
      await loadFixture(deployFixture);
      const startTime = (await time.latest()) + 100;
      await rewardToken.approve(
        staking.address,
        totalAmount.mul(percentage).mul(amountOfEpochs).div(HUNDRED_PERCENT)
      );
      await staking.initialize(
        totalAmount,
        percentage,
        epochDuration,
        amountOfEpochs,
        startTime
      );
      expect(await staking.tokensLeft()).to.be.eq(totalAmount);
      expect(await staking.percentage()).to.be.eq(percentage);
      expect(await staking.epochDuration()).to.be.eq(epochDuration);
      expect(await staking.amountOfEpochs()).to.be.eq(amountOfEpochs);
      expect(await staking.startTime()).to.be.eq(startTime);
    });

    it("Should be unable to initialize twice", async () => {
      await loadFixture(deployInitFixture);
      await expect(
        staking.initialize(
          totalAmount,
          percentage,
          epochDuration,
          amountOfEpochs,
          0
        )
      ).to.be.revertedWith("Already initialized");
    });
  });

  describe("Deposit", async () => {
    it("Should deposit correctly", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking
        .connect(accounts[0])
        .deposit(ethers.utils.parseEther("100"));
      expect(await staking.tokensLeft()).to.be.eq(
        totalAmount.sub(ethers.utils.parseEther("100"))
      );
    });

    it("Should be unable to deposit before startTime", async () => {
      await loadFixture(deployInitFixture);
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await expect(
        staking.connect(accounts[0]).deposit(ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Staking is not up yet");
    });

    it("Should be unable to deposit more tokens than left", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await expect(
        staking.connect(accounts[0]).deposit(ethers.utils.parseEther("1001"))
      ).to.be.revertedWith("Too many tokens contributed");
    });
  });

  describe("Withdrawal and Claim", () => {
    it("Should withdraw correctly", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking
        .connect(accounts[0])
        .deposit(ethers.utils.parseEther("100"));

      await time.increaseTo(
        (
          await staking.users(accounts[0].address)
        ).depositTime.add(
          (await staking.epochDuration()).mul(await staking.amountOfEpochs())
        )
      );
      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(0);
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0);
      await staking.connect(accounts[0]).claimRewards();
      await staking.connect(accounts[0]).withdraw();
      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(
        ethers.utils.parseEther("30")
      );
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(
        ethers.utils.parseEther("100")
      );
    });

    it("Should be unable to claim twice", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking
        .connect(accounts[0])
        .deposit(ethers.utils.parseEther("100"));

      await time.increaseTo(
        (
          await staking.users(accounts[0].address)
        ).depositTime.add(
          (await staking.epochDuration()).mul(await staking.amountOfEpochs())
        )
      );

      await staking.connect(accounts[0]).claimRewards();
      await expect(staking.connect(accounts[0]).claimRewards()).be.revertedWith(
        "already claimed"
      );
      await staking.connect(accounts[0]).withdraw();
    });

    it("Should be unable to withdraw before claim", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking
        .connect(accounts[0])
        .deposit(ethers.utils.parseEther("100"));

      await time.increaseTo(
        (
          await staking.users(accounts[0].address)
        ).depositTime.add(
          (await staking.epochDuration()).mul(await staking.amountOfEpochs())
        )
      );
      await expect(staking.connect(accounts[0]).withdraw()).to.be.revertedWith(
        "not claimed yet"
      );
      await staking.connect(accounts[0]).claimRewards();
    });

    it("Should be unable to claim without a stake", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking
        .connect(accounts[0])
        .deposit(ethers.utils.parseEther("100"));

      await time.increaseTo(
        (
          await staking.users(accounts[0].address)
        ).depositTime.add(
          (await staking.epochDuration()).mul(await staking.amountOfEpochs())
        )
      );
      await staking.connect(accounts[1]).claimRewards();
      await expect(staking.connect(accounts[1]).withdraw()).to.be.revertedWith(
        "nothing to withdraw"
      );
    });

    it("Should be unable to claim too early", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());
      await stakingToken
        .connect(accounts[0])
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking
        .connect(accounts[0])
        .deposit(ethers.utils.parseEther("100"));

      await time.increaseTo(
        (
          await staking.users(accounts[0].address)
        ).depositTime.add(await staking.epochDuration())
      );
      await expect(
        staking.connect(accounts[0]).claimRewards()
      ).to.be.revertedWith("too early to claim");
    });
  });

  describe("Full Cycle", () => {
    it("10 users should deposit, claim and withdraw w/o issues", async () => {
      await loadFixture(deployInitFixture);
      await time.increaseTo(await staking.startTime());

      for (let i = 0; i < 10; i++) {
        const stakeAmount = getRandomArbitrary(1, 100);

        await stakingToken
          .connect(accounts[i])
          .approve(
            staking.address,
            ethers.utils.parseEther(stakeAmount.toString())
          );
        await staking
          .connect(accounts[i])
          .deposit(ethers.utils.parseEther(stakeAmount.toString()));
      }

      await time.increaseTo(
        (
          await staking.users(accounts[9].address)
        ).depositTime.add(
          (await staking.epochDuration()).mul(await staking.amountOfEpochs())
        )
      );

      for (let i = 0; i < 10; i++) {
        const amount = (await staking.users(accounts[i].address)).amount;
        await staking.connect(accounts[i]).claimRewards();
        await staking.connect(accounts[i]).withdraw();
        expect(await rewardToken.balanceOf(accounts[i].address)).to.be.eq(
          amount.mul(percentage).mul(amountOfEpochs).div(HUNDRED_PERCENT)
        );
        expect(await stakingToken.balanceOf(accounts[i].address)).to.be.eq(
          ethers.utils.parseEther("100")
        );
      }

      const stakeAmount = await staking.tokensLeft();
      await stakingToken.connect(owner).approve(staking.address, stakeAmount);
      await staking.connect(owner).deposit(stakeAmount);
      await time.increaseTo(
        (
          await staking.users(owner.address)
        ).depositTime.add(
          (await staking.epochDuration()).mul(await staking.amountOfEpochs())
        )
      );
      const balanceBeforeClaim = await rewardToken.balanceOf(owner.address);
      await staking.connect(owner).claimRewards();
      await staking.connect(owner).withdraw();
      expect(
        (await rewardToken.balanceOf(owner.address)).sub(balanceBeforeClaim)
      ).to.be.eq(
        stakeAmount.mul(percentage).mul(amountOfEpochs).div(HUNDRED_PERCENT)
      );

      expect(await stakingToken.balanceOf(staking.address)).to.be.eq(0);
      expect(await rewardToken.balanceOf(staking.address)).to.be.eq(0);
    });
  });
});

function getRandomArbitrary(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}
